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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        specialty TEXT,
        qualification TEXT,
        consultation_fee NUMERIC,
        rating NUMERIC DEFAULT 0,
        available BOOLEAN DEFAULT TRUE
      );
    `);

    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS user_id INTEGER;');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS specialty TEXT;');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS qualification TEXT;');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC;');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0;');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT TRUE;');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS doctors_user_id_key ON doctors(user_id);');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS availability (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN DEFAULT TRUE
      );
    `);

    await pool.query('ALTER TABLE availability ADD COLUMN IF NOT EXISTS doctor_id INTEGER;');
    await pool.query('ALTER TABLE availability ADD COLUMN IF NOT EXISTS day_of_week INTEGER;');
    await pool.query('ALTER TABLE availability ADD COLUMN IF NOT EXISTS start_time TIME;');
    await pool.query('ALTER TABLE availability ADD COLUMN IF NOT EXISTS end_time TIME;');
    await pool.query('ALTER TABLE availability ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL,
        patient_id INTEGER,
        appointment_time TIMESTAMP,
        status VARCHAR(50) DEFAULT 'scheduled',
        payment_status VARCHAR(50) DEFAULT 'pending',
        meeting_link TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        prescription JSONB DEFAULT '[]'::jsonb,
        prescription_notes TEXT
      );
    `);

    await pool.query(
      "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prescription JSONB DEFAULT '[]'::jsonb;"
    );
    await pool.query(
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prescription_notes TEXT;'
    );

    console.log('[DoctorService] Database tables ready');
  } catch (error) {
    console.error('[DoctorService] Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initDB };
