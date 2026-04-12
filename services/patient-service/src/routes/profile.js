const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const router = express.Router();

router.get('/profile', verifyToken, requireRole('patient'), async (req, res) => {
  try {
    const patientResult = await pool.query(
      'SELECT * FROM patients WHERE user_id = $1',
      [req.user.id]
    );

    if (patientResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'Profile not found. Please create your profile first.' });
    }

    const patient = patientResult.rows[0];

    const historyResult = await pool.query(
      'SELECT * FROM medical_history WHERE patient_id = $1',
      [patient.id]
    );

    const medicalHistory = historyResult.rows[0] || null;

    return res.json({
      ...patient,
      medical_history: medicalHistory,
    });
  } catch (error) {
    console.error('[PatientService] GET /profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/profile', verifyToken, requireRole('patient'), async (req, res) => {
  try {
    const {
      name,
      phone,
      date_of_birth,
      gender,
      blood_type,
      address,
      emergency_contact_name,
      emergency_contact_phone,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existingProfileResult = await pool.query(
      'SELECT id FROM patients WHERE user_id = $1',
      [req.user.id]
    );

    if (existingProfileResult.rows.length > 0) {
      return res
        .status(409)
        .json({ error: 'Profile already exists. Use PUT to update.' });
    }

    const insertPatientResult = await pool.query(
      `
        INSERT INTO patients (
          user_id,
          name,
          email,
          phone,
          date_of_birth,
          gender,
          blood_type,
          address,
          emergency_contact_name,
          emergency_contact_phone
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        req.user.id,
        name,
        req.user.email,
        phone || null,
        date_of_birth || null,
        gender || null,
        blood_type || null,
        address || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
      ]
    );

    const patient = insertPatientResult.rows[0];

    await pool.query('INSERT INTO medical_history (patient_id) VALUES ($1)', [
      patient.id,
    ]);

    return res.status(201).json(patient);
  } catch (error) {
    console.error('[PatientService] POST /profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/profile', verifyToken, requireRole('patient'), async (req, res) => {
  try {
    const {
      name,
      phone,
      date_of_birth,
      gender,
      blood_type,
      address,
      emergency_contact_name,
      emergency_contact_phone,
    } = req.body;

    const updateResult = await pool.query(
      `
        UPDATE patients
        SET
          name = $1,
          phone = $2,
          date_of_birth = $3,
          gender = $4,
          blood_type = $5,
          address = $6,
          emergency_contact_name = $7,
          emergency_contact_phone = $8,
          updated_at = NOW()
        WHERE user_id = $9
        RETURNING *
      `,
      [
        name || null,
        phone || null,
        date_of_birth || null,
        gender || null,
        blood_type || null,
        address || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        req.user.id,
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('[PatientService] PUT /profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
