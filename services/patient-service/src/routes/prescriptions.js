const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const router = express.Router();

router.get('/prescriptions', verifyToken, requireRole('patient'), async (req, res) => {
  try {
    const patientResult = await pool.query(
      'SELECT id FROM patients WHERE user_id = $1',
      [req.user.id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const patientId = patientResult.rows[0].id;

    const prescriptionsResult = await pool.query(
      `
        SELECT *
        FROM prescriptions
        WHERE patient_id = $1
        ORDER BY issued_at DESC
      `,
      [patientId]
    );

    return res.json(prescriptionsResult.rows);
  } catch (error) {
    console.error('[PatientService] GET /prescriptions error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/prescriptions', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    const { patientId, doctorName, appointmentId, medications, notes } = req.body;

    if (!patientId || !medications) {
      return res
        .status(400)
        .json({ error: 'patientId and medications are required' });
    }

    const insertResult = await pool.query(
      `
        INSERT INTO prescriptions (
          patient_id,
          doctor_id,
          doctor_name,
          appointment_id,
          medications,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        patientId,
        req.user.id,
        doctorName || null,
        appointmentId || null,
        JSON.stringify(medications),
        notes || null,
      ]
    );

    return res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    console.error('[PatientService] POST /prescriptions error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
