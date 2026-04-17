const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'secret',
      database: process.env.DB_NAME || 'healthcare',
    });

async function initDB() {
  try {
    await pool.query('SELECT 1');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS telemedicine_sessions (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        meeting_link TEXT NOT NULL,
        started_by_doctor_user_id INTEGER NOT NULL REFERENCES users(id),
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meeting_link TEXT'
    );

    console.log('[TelemedicineService] Database connection ready');
  } catch (error) {
    console.error('[TelemedicineService] Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initDB };
