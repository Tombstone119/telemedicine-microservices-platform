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

router.get('/appointments', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    await ensureDoctorRow(req.user);

    const result = await pool.query(
      `
        SELECT *
        FROM appointments
        WHERE doctor_id = $1
        ORDER BY appointment_time DESC NULLS LAST,
                 created_at DESC
      `,
      [req.user.id]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('[DoctorService] GET /appointments error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/appointments/:id/status', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    await ensureDoctorRow(req.user);

    const { status } = req.body;
    const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const result = await pool.query(
      `
        UPDATE appointments
        SET
          status = $1
        WHERE id = $2 AND doctor_id = $3
        RETURNING *
      `,
      [status, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] PUT /appointments/:id/status error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
