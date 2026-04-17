const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const router = express.Router();

router.get('/medical-history', verifyToken, requireRole('patient'), async (req, res) => {
  try {
    const patientResult = await pool.query(
      'SELECT id FROM patients WHERE user_id = $1',
      [req.user.id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Create your profile first' });
    }

    const patientId = patientResult.rows[0].id;

    const historyResult = await pool.query(
      'SELECT * FROM medical_history WHERE patient_id = $1',
      [patientId]
    );

    return res.json(historyResult.rows[0] || {});
  } catch (error) {
    console.error('[PatientService] GET /medical-history error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/medical-history', verifyToken, requireRole('patient'), async (req, res) => {
  try {
    const { allergies, conditions, medications, notes } = req.body;

    const patientResult = await pool.query(
      'SELECT id FROM patients WHERE user_id = $1',
      [req.user.id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Create your profile first' });
    }

    const patientId = patientResult.rows[0].id;

    const updateResult = await pool.query(
      `
        UPDATE medical_history
        SET
          allergies = $1,
          conditions = $2,
          medications = $3,
          notes = $4,
          updated_at = NOW()
        WHERE patient_id = $5
        RETURNING *
      `,
      [
        allergies || [],
        conditions || [],
        medications || [],
        notes || null,
        patientId,
      ]
    );

    return res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('[PatientService] PUT /medical-history error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
