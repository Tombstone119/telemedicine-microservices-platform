const crypto = require('crypto');
const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const router = express.Router();

const joinGraceMinutes = parseInt(process.env.SESSION_JOIN_GRACE_MINUTES, 10) || 15;
const meetingBaseUrl = (process.env.MEETING_BASE_URL || 'https://meet.jit.si').replace(/\/$/, '');
const roomPrefix = process.env.MEETING_ROOM_PREFIX || 'telemedicine';

function buildMeetingLink(appointmentId) {
  const token = crypto.randomBytes(8).toString('hex');
  const room = `${roomPrefix}-appointment-${appointmentId}-${token}`;
  return `${meetingBaseUrl}/${room}`;
}

async function getDoctorByUserId(userId) {
  const result = await pool.query(
    `
      SELECT id, user_id
      FROM doctors
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function fetchAppointmentWithOwnership(appointmentId) {
  const result = await pool.query(
    `
      SELECT a.*, d.user_id AS doctor_user_id
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      WHERE a.id = $1
      LIMIT 1
    `,
    [appointmentId]
  );

  return result.rows[0] || null;
}

function canAccessAppointment(appointment, user) {
  if (user.role === 'doctor') {
    return appointment.doctor_user_id === user.id;
  }

  if (user.role === 'patient') {
    return appointment.patient_id === user.id;
  }

  return false;
}

router.get('/appointments/:id', verifyToken, requireRole('patient', 'doctor'), async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }

    const appointment = await fetchAppointmentWithOwnership(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (!canAccessAppointment(appointment, req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json(appointment);
  } catch (error) {
    console.error('[TelemedicineService] GET /appointments/:id error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/appointments/:id/start', verifyToken, requireRole('doctor'), async (req, res) => {
  const client = await pool.connect();

  try {
    const appointmentId = parseInt(req.params.id, 10);
    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }

    const doctor = await getDoctorByUserId(req.user.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    await client.query('BEGIN');

    const appointmentResult = await client.query(
      `
        SELECT id, doctor_id, patient_id, status, meeting_link, appointment_time
        FROM appointments
        WHERE id = $1
        FOR UPDATE
      `,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.doctor_id !== doctor.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!['confirmed', 'completed'].includes(appointment.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Appointment must be confirmed before starting session' });
    }

    const meetingLink = appointment.meeting_link || buildMeetingLink(appointment.id);

    await client.query(
      `
        UPDATE appointments
        SET meeting_link = $1
        WHERE id = $2
      `,
      [meetingLink, appointment.id]
    );

    await client.query(
      `
        INSERT INTO telemedicine_sessions (
          appointment_id,
          meeting_link,
          started_by_doctor_user_id,
          started_at,
          ended_at
        )
        VALUES ($1, $2, $3, NOW(), NULL)
        ON CONFLICT (appointment_id)
        DO UPDATE SET
          meeting_link = EXCLUDED.meeting_link,
          started_by_doctor_user_id = EXCLUDED.started_by_doctor_user_id,
          started_at = NOW(),
          ended_at = NULL
      `,
      [appointment.id, meetingLink, req.user.id]
    );

    await client.query('COMMIT');

    return res.json({
      appointment_id: appointment.id,
      meeting_link: meetingLink,
      status: appointment.status,
      started_at: new Date().toISOString(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[TelemedicineService] POST /appointments/:id/start error:', error);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.post('/appointments/:id/join', verifyToken, requireRole('patient', 'doctor'), async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }

    const appointment = await fetchAppointmentWithOwnership(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (!canAccessAppointment(appointment, req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!appointment.meeting_link) {
      return res.status(409).json({ error: 'Session has not been started by doctor yet' });
    }

    const now = new Date();
    const appointmentTime = new Date(appointment.appointment_time);
    const earliestJoinTime = new Date(appointmentTime.getTime() - joinGraceMinutes * 60 * 1000);

    if (now < earliestJoinTime) {
      return res.status(409).json({
        error: `Session can be joined within ${joinGraceMinutes} minutes before appointment time`,
      });
    }

    return res.json({
      appointment_id: appointment.id,
      meeting_link: appointment.meeting_link,
      appointment_time: appointment.appointment_time,
      status: appointment.status,
    });
  } catch (error) {
    console.error('[TelemedicineService] POST /appointments/:id/join error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/appointments/:id/end', verifyToken, requireRole('doctor'), async (req, res) => {
  const client = await pool.connect();

  try {
    const appointmentId = parseInt(req.params.id, 10);
    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }

    const doctor = await getDoctorByUserId(req.user.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    await client.query('BEGIN');

    const appointmentResult = await client.query(
      `
        SELECT id, doctor_id, status
        FROM appointments
        WHERE id = $1
        FOR UPDATE
      `,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];
    if (appointment.doctor_id !== doctor.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    await client.query(
      `
        UPDATE telemedicine_sessions
        SET ended_at = NOW()
        WHERE appointment_id = $1
      `,
      [appointment.id]
    );

    await client.query(
      `
        UPDATE appointments
        SET status = CASE WHEN status = 'confirmed' THEN 'completed' ELSE status END
        WHERE id = $1
      `,
      [appointment.id]
    );

    await client.query('COMMIT');

    return res.json({ success: true, appointment_id: appointment.id, ended_at: new Date().toISOString() });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[TelemedicineService] POST /appointments/:id/end error:', error);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.get('/my-sessions', verifyToken, requireRole('patient', 'doctor'), async (req, res) => {
  try {
    const role = req.user.role;
    let whereClause;
    const values = [];

    if (role === 'patient') {
      values.push(req.user.id);
      whereClause = `a.patient_id = $${values.length}`;
    } else {
      const doctor = await getDoctorByUserId(req.user.id);
      if (!doctor) {
        return res.status(404).json({ error: 'Doctor profile not found' });
      }

      values.push(doctor.id);
      whereClause = `a.doctor_id = $${values.length}`;
    }

    const result = await pool.query(
      `
        SELECT a.id, a.patient_id, a.doctor_id, a.appointment_time, a.status, a.meeting_link,
               t.started_at, t.ended_at
        FROM appointments a
        LEFT JOIN telemedicine_sessions t ON t.appointment_id = a.id
        WHERE ${whereClause}
        ORDER BY a.appointment_time DESC, a.created_at DESC
      `,
      values
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('[TelemedicineService] GET /my-sessions error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
