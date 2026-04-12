const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const router = require('express').Router();

// Apply auth middleware to all routes
router.use(verifyToken);
router.use(requireRole('doctor'));

// Get doctor profile
router.get('/profile', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM doctors
       WHERE user_id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] GET /profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create or update doctor profile
router.put('/profile', async (req, res) => {
  try {
    const { specialty, qualification, consultation_fee } = req.body;
    
    // Check if profile exists
    const result = await pool.query(
      `
        INSERT INTO doctors (user_id, specialty, qualification, consultation_fee, available)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (user_id)
        DO UPDATE SET
          specialty = COALESCE(EXCLUDED.specialty, doctors.specialty),
          qualification = COALESCE(EXCLUDED.qualification, doctors.qualification),
          consultation_fee = COALESCE(EXCLUDED.consultation_fee, doctors.consultation_fee),
          available = TRUE
        RETURNING *
      `,
      [req.user.id, specialty || null, qualification || null, consultation_fee || null]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] PUT /profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
