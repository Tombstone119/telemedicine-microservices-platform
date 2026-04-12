const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const router = express.Router();

async function ensureDoctorRow(user) {
  const existing = await pool.query(
    `
      SELECT id
      FROM doctors
      WHERE user_id = $1
      LIMIT 1
    `,
    [user.id]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const inserted = await pool.query(
    `
      INSERT INTO doctors (user_id, available)
      VALUES ($1, TRUE)
      ON CONFLICT (user_id)
      DO UPDATE SET
        available = TRUE
      RETURNING id
    `,
    [user.id]
  );

  return inserted.rows[0].id;
}

function normalizeDayOfWeek(value) {
  if (value === undefined || value === null) return null;
  if (Number.isInteger(value)) return value;

  const map = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const normalized = map[String(value).toLowerCase()];
  return normalized !== undefined ? normalized : null;
}

router.get('/availability', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    const doctorId = await ensureDoctorRow(req.user);

    const result = await pool.query(
      `
        SELECT *
        FROM availability
        WHERE doctor_id = $1
        ORDER BY day_of_week, start_time
      `,
      [doctorId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('[DoctorService] GET /availability error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/availability', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    const doctorId = await ensureDoctorRow(req.user);

    const { day_of_week, start_time, end_time, is_available } = req.body;
    const dayOfWeek = normalizeDayOfWeek(day_of_week);

    if (dayOfWeek === null || !start_time || !end_time) {
      return res.status(400).json({ error: 'day_of_week, start_time and end_time are required' });
    }

    const result = await pool.query(
      `
        INSERT INTO availability (
          doctor_id,
          day_of_week,
          start_time,
          end_time,
          is_available
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        doctorId,
        dayOfWeek,
        start_time,
        end_time,
        is_available !== undefined ? is_available : true,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] POST /availability error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/availability', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    const doctorId = await ensureDoctorRow(req.user);

    const { id, day_of_week, start_time, end_time, is_available } = req.body;
    const dayOfWeek = normalizeDayOfWeek(day_of_week);

    if (!id) {
      return res.status(400).json({ error: 'Availability id is required' });
    }

    const result = await pool.query(
      `
        UPDATE availability
        SET
          day_of_week = COALESCE($1, day_of_week),
          start_time = COALESCE($2, start_time),
          end_time = COALESCE($3, end_time),
          is_available = COALESCE($4, is_available)
        WHERE id = $5 AND doctor_id = $6
        RETURNING *
      `,
      [
        dayOfWeek,
        start_time || null,
        end_time || null,
        is_available !== undefined ? is_available : null,
        id,
        doctorId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Availability not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] PUT /availability error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
