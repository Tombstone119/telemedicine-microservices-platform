const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const router = express.Router();

async function getPatientContext(identifier) {
  const result = await pool.query(
    `
      SELECT
        p.id,
        p.user_id,
        p.name,
        p.email,
        p.phone,
        p.blood_type,
        p.created_at,
        p.updated_at,
        u.full_name,
        u.status
      FROM patients p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id::text = $1 OR p.user_id::text = $1
      LIMIT 1
    `,
    [identifier]
  );

  return result.rows[0] || null;
}

// ============ EXISTING ROUTES ============

router.get('/all', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const patientsResult = await pool.query(
      `
        SELECT id, name, email, phone, blood_type, created_at
        FROM patients
        ORDER BY created_at DESC
      `
    );
    return res.json(patientsResult.rows);
  } catch (error) {
    console.error('[PatientService] GET /all error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', verifyToken, requireRole('admin', 'doctor'), async (req, res) => {
  try {
    const patientResult = await pool.query(
      'SELECT * FROM patients WHERE id = $1',
      [req.params.id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientResult.rows[0];

    const historyResult = await pool.query(
      'SELECT * FROM medical_history WHERE patient_id = $1',
      [req.params.id]
    );

    return res.json({
      ...patient,
      medical_history: historyResult.rows[0] || null,
    });
  } catch (error) {
    console.error('[PatientService] GET /:id error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============ NEW ROUTES FOR ADMIN PATIENT DETAIL PAGE ============

router.get('/admin/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await getPatientContext(id);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    console.error('[PatientService] GET /admin/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

router.get('/admin/:id/appointments', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await getPatientContext(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const result = await pool.query(
      `SELECT a.id, a.appointment_time, a.status, a.payment_status,
              d.specialty, d.consultation_fee,
              u_doctor.full_name as doctor_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users u_doctor ON u_doctor.id = d.user_id
       WHERE a.patient_id = $1
       ORDER BY a.appointment_time DESC`,
      [patient.user_id]
    );
    
    const items = result.rows.map(row => ({
      id: row.id,
      doctor_name: row.doctor_name,
      doctor_specialty: row.specialty,
      date: row.appointment_time ? new Date(row.appointment_time).toLocaleDateString() : null,
      time: row.appointment_time ? new Date(row.appointment_time).toLocaleTimeString() : null,
      status: row.status,
      fee: row.consultation_fee,
      payment_status: row.payment_status,
    }));
    
    res.json({ items });
  } catch (error) {
    console.error('[PatientService] GET /admin/:id/appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

router.get('/admin/:id/prescriptions', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await getPatientContext(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const result = await pool.query(
      `SELECT pr.id, pr.doctor_name, pr.issued_at, pr.medications, pr.notes
       FROM prescriptions pr
       WHERE pr.patient_id = $1
       ORDER BY pr.issued_at DESC`,
      [patient.id]
    );
    
    const items = result.rows.map(row => ({
      id: row.id,
      doctor_name: row.doctor_name,
      issue_date: row.issued_at ? new Date(row.issued_at).toLocaleDateString() : null,
      medications: row.medications,
      notes: row.notes,
    }));
    
    res.json({ items });
  } catch (error) {
    console.error('[PatientService] GET /admin/:id/prescriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

router.get('/admin/:id/medical-history', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await getPatientContext(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const result = await pool.query(
      `SELECT mh.*
       FROM medical_history mh
       WHERE mh.patient_id = $1`,
      [patient.id]
    );
    
    const items = result.rows.length > 0 ? [{
      id: result.rows[0].id,
      allergies: result.rows[0].allergies || [],
      conditions: result.rows[0].conditions || [],
      medications: result.rows[0].medications || [],
      notes: result.rows[0].notes,
    }] : [];
    
    res.json({ items });
  } catch (error) {
    console.error('[PatientService] GET /admin/:id/medical-history error:', error);
    res.status(500).json({ error: 'Failed to fetch medical history' });
  }
});

router.get('/admin/:id/payments', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await getPatientContext(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const result = await pool.query(
      `SELECT a.id as appointment_id, a.appointment_time, a.payment_status,
              d.consultation_fee as amount,
              u_doctor.full_name as doctor_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users u_doctor ON u_doctor.id = d.user_id
       WHERE a.patient_id = $1
       AND a.payment_status = 'paid'
       ORDER BY a.appointment_time DESC`,
      [patient.user_id]
    );
    
    const items = result.rows.map(row => ({
      id: row.appointment_id,
      appointment_id: row.appointment_id,
      doctor_name: row.doctor_name,
      amount: row.amount,
      date: row.appointment_time ? new Date(row.appointment_time).toISOString() : null,
      status: row.payment_status,
      method: 'Card',
    }));
    
    res.json({ items });
  } catch (error) {
    console.error('[PatientService] GET /admin/:id/payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.get('/admin/:id/activities', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await getPatientContext(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const result = await pool.query(
      `SELECT a.created_at, 'appointment' as type,
              CONCAT('Appointment scheduled with Dr. ', u_doctor.full_name) as description,
              a.status
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users u_doctor ON u_doctor.id = d.user_id
       WHERE a.patient_id = $1
       UNION ALL
       SELECT pr.issued_at as created_at, 'prescription' as type,
              CONCAT('Prescription issued by ', COALESCE(pr.doctor_name, 'a doctor')) as description,
              NULL as status
       FROM prescriptions pr
       WHERE pr.patient_id = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [patient.user_id, patient.id]
    );
    
    const items = result.rows.map((row, index) => ({
      id: index + 1,
      date: row.created_at,
      type: row.type,
      description: row.description,
      status: row.status,
    }));
    
    res.json({ items });
  } catch (error) {
    console.error('[PatientService] GET /admin/:id/activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

router.post('/admin/:id/suspend', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const patientResult = await pool.query(
      `SELECT user_id FROM patients WHERE id::text = $1 OR user_id::text = $1`,
      [id]
    );
    
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const userId = patientResult.rows[0].user_id;
    
    await pool.query(
      `UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('[PatientService] POST /admin/:id/suspend error:', error);
    res.status(500).json({ error: 'Failed to suspend patient' });
  }
});

router.post('/admin/:id/activate', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const patientResult = await pool.query(
      `SELECT user_id FROM patients WHERE id::text = $1 OR user_id::text = $1`,
      [id]
    );
    
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const userId = patientResult.rows[0].user_id;
    
    await pool.query(
      `UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('[PatientService] POST /admin/:id/activate error:', error);
    res.status(500).json({ error: 'Failed to activate patient' });
  }
});

module.exports = router;