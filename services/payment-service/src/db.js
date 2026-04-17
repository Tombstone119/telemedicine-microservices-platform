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

    await pool.query(
      "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending'"
    );

    await pool.query(
      `
        ALTER TABLE appointments
        ADD CONSTRAINT appointments_payment_status_check
        CHECK (payment_status IN ('pending', 'paid', 'failed'))
        NOT VALID
      `
    ).catch(() => null);

    console.log('[PaymentService] Database connection ready');
  } catch (error) {
    console.error('[PaymentService] Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initDB };
