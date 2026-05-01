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
      "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ"
    );

    await pool.query(
      `
        ALTER TABLE appointments
        ADD CONSTRAINT appointments_payment_status_check
        CHECK (payment_status IN ('pending', 'paid', 'failed'))
        NOT VALID
      `
    ).catch(() => null);

    // Create doctor_earnings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_earnings (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL,
        appointment_id INTEGER NOT NULL UNIQUE,
        total_amount NUMERIC(10, 2) NOT NULL,
        platform_fee NUMERIC(10, 2) NOT NULL,
        doctor_amount NUMERIC(10, 2) NOT NULL,
        payment_status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
      )
    `);

    // Create doctor_wallets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_wallets (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL UNIQUE,
        balance NUMERIC(12, 2) DEFAULT 0,
        total_earned NUMERIC(12, 2) DEFAULT 0,
        total_withdrawn NUMERIC(12, 2) DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      )
    `);

    // Create doctor_bank_accounts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_bank_accounts (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL UNIQUE,
        account_holder_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        bank_name VARCHAR(255) NOT NULL,
        branch_name VARCHAR(255),
        ifsc_code VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      )
    `);

    // Create payment_receipts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_receipts (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL UNIQUE,
        doctor_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        receipt_number VARCHAR(50) UNIQUE NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        platform_fee NUMERIC(10, 2) NOT NULL,
        doctor_amount NUMERIC(10, 2) NOT NULL,
        generated_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id),
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        FOREIGN KEY (patient_id) REFERENCES users(id)
      )
    `);

    console.log('[PaymentService] Database connection ready');
  } catch (error) {
    console.error('[PaymentService] Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initDB };
