const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_NAME || 'healthcare',
});

async function initDB() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    await pool.query(`
      DROP TABLE IF EXISTS prescriptions CASCADE;
      DROP TABLE IF EXISTS medical_reports CASCADE;
      DROP TABLE IF EXISTS medical_history CASCADE;
      DROP TABLE IF EXISTS patients CASCADE;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        date_of_birth DATE,
        gender TEXT CHECK (gender IN ('male', 'female', 'other')),
        blood_type TEXT,
        address TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS medical_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        allergies TEXT[] DEFAULT '{}',
        conditions TEXT[] DEFAULT '{}',
        medications TEXT[] DEFAULT '{}',
        notes TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS medical_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID NOT NULL,
        doctor_name TEXT,
        appointment_id UUID,
        medications JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        issued_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('[PatientService] Database tables ready');
    return true;
  } catch (error) {
    console.error('[PatientService] Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initDB };
