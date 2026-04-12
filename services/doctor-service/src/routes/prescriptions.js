const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const router = express.Router();

async function ensureDoctorRow(user) {
  await pool.query(
    `
      INSERT INTO doctors (user_id, available)
      VALUES ($1, TRUE)
      ON CONFLICT (user_id)
      DO UPDATE SET
        available = TRUE
    `,
    [user.id]
  );
}

router.post('/prescriptions', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    await ensureDoctorRow(req.user);

    const { patientId, appointmentId, medications, notes } = req.body;

    if (!patientId || !medications) {
      return res.status(400).json({ error: 'patientId and medications are required' });
    }

    if (!Array.isArray(medications)) {
      return res.status(400).json({ error: 'medications must be an array' });
    }

    if (appointmentId) {
      const updateResult = await pool.query(
        `
          UPDATE appointments
          SET
            prescription = $1::jsonb,
            prescription_notes = $2,
            status = 'completed'
          WHERE id = $3 AND doctor_id = $4
          RETURNING *
        `,
        [JSON.stringify(medications), notes || null, appointmentId, req.user.id]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      return res.status(201).json(updateResult.rows[0]);
    }

    const insertResult = await pool.query(
      `
        INSERT INTO appointments (
          doctor_id,
          patient_id,
          appointment_time,
          status,
          prescription,
          prescription_notes
        )
        VALUES ($1, $2, NOW(), 'completed', $3::jsonb, $4)
        RETURNING *
      `,
      [
        req.user.id,
        patientId,
        JSON.stringify(medications),
        notes || null,
      ]
    );

    return res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    console.error('[DoctorService] POST /prescriptions error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
