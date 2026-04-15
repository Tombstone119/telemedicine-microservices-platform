const pool = require('./db');

async function initializeSchema() {
  try {
    // Create video_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_sessions (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        room_id VARCHAR(255) NOT NULL UNIQUE,
        meeting_link TEXT NOT NULL,
        jitsi_token TEXT,
        status VARCHAR(20) DEFAULT 'created' CHECK (status IN ('created', 'started', 'ended', 'cancelled')),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration_minutes INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(appointment_id)
      );
    `);

    // Create session_participants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_participants (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('doctor', 'patient')),
        joined_at TIMESTAMP,
        left_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, user_id)
      );
    `);

    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_video_sessions_appointment_id ON video_sessions(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_video_sessions_doctor_id ON video_sessions(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_video_sessions_patient_id ON video_sessions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON video_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
    `);

    console.log('✓ Telemedicine database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing telemedicine database schema:', error);
    throw error;
  }
}

module.exports = { initializeSchema };