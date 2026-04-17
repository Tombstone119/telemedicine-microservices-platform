const router = require('express').Router();
const { pool } = require('../db/pool');

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-symptom-service',
    timestamp: new Date().toISOString(),
  });
});

router.get('/health/ready', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ready',
      checks: {
        postgres: 'ok',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
