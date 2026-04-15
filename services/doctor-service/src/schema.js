const pool = require('./db');

async function initializeSchema() {
  try {
    // Create doctors table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL UNIQUE,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20),
        specialty VARCHAR(255) NOT NULL,
        bio TEXT,
        license_number VARCHAR(255) NOT NULL UNIQUE,
        license_expiry DATE,
        experience_years INTEGER,
        education JSON,
        hospital_affiliation VARCHAR(255),
        consultation_fee DECIMAL(10, 2),
        languages JSON DEFAULT '["English"]'::json,
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create availability table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_availability (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        day_of_week VARCHAR(10) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, day_of_week)
      );
    `);

    // Create leave/unavailable dates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_leaves (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        leave_date DATE NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, leave_date)
      );
    `);

    // Create appointments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        duration_minutes INTEGER DEFAULT 30,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
        symptoms TEXT,
        notes TEXT,
        consultation_fee DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, appointment_date, appointment_time)
      );
    `);

    // Create prescriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL,
        medicines JSON NOT NULL,
        dosage_instructions TEXT,
        notes TEXT,
        issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_until DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create prescription_medicines table for better structure
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prescription_medicines (
        id SERIAL PRIMARY KEY,
        prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
        medicine_name VARCHAR(255) NOT NULL,
        dosage VARCHAR(100) NOT NULL,
        frequency VARCHAR(100),
        duration_days INTEGER,
        instructions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);
      CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty);
      CREATE INDEX IF NOT EXISTS idx_doctors_is_active ON doctors(is_active);
      CREATE INDEX IF NOT EXISTS idx_availability_doctor_id ON doctor_availability(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_leaves_doctor_id ON doctor_leaves(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment_id ON prescriptions(appointment_id);
    `);

    console.log('✓ Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

module.exports = { initializeSchema };
