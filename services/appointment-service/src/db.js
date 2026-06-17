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
      DO $$
      BEGIN
        IF to_regclass('public.users') IS NOT NULL AND to_regclass('public.doctors') IS NOT NULL THEN
          INSERT INTO doctors (user_id, available, approval_status)
          SELECT u.id, FALSE, 'pending'
          FROM users u
          WHERE u.role = 'doctor'
            AND NOT EXISTS (
              SELECT 1
              FROM doctors d
              WHERE d.user_id = u.id
            );
        END IF;
      END $$;
    `);

    await pool.query(
      "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending'"
    );
    await pool.query(
      "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prescription JSONB DEFAULT '[]'::jsonb"
    );
    await pool.query(
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prescription_notes TEXT'
    );
    await pool.query("ALTER TABLE appointments ALTER COLUMN status SET DEFAULT 'pending'");
    await pool.query("UPDATE appointments SET status = 'pending' WHERE status = 'scheduled'");

    console.log('[AppointmentService] Database connection ready');
  } catch (error) {
    console.error('[AppointmentService] Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initDB };
