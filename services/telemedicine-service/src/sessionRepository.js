const pool = require('./db');

const sessionRepository = {
  /**
   * Create a new video session
   */
  async createSession(sessionData) {
    const {
      appointment_id, doctor_id, patient_id, room_id,
      meeting_link, jitsi_token, status = 'created'
    } = sessionData;

    const query = `
      INSERT INTO video_sessions (
        appointment_id, doctor_id, patient_id, room_id,
        meeting_link, jitsi_token, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [
      appointment_id, doctor_id, patient_id, room_id,
      meeting_link, jitsi_token, status
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Get session by appointment ID
   */
  async getSessionByAppointmentId(appointmentId) {
    const query = `
      SELECT * FROM video_sessions WHERE appointment_id = $1;
    `;
    const result = await pool.query(query, [appointmentId]);
    return result.rows[0];
  },

  /**
   * Get session by ID
   */
  async getSessionById(sessionId) {
    const query = `
      SELECT * FROM video_sessions WHERE id = $1;
    `;
    const result = await pool.query(query, [sessionId]);
    return result.rows[0];
  },

  /**
   * Get sessions by doctor ID
   */
  async getSessionsByDoctor(doctorId, limit = 50) {
    const query = `
      SELECT * FROM video_sessions
      WHERE doctor_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [doctorId, limit]);
    return result.rows;
  },

  /**
   * Get sessions by patient ID
   */
  async getSessionsByPatient(patientId, limit = 50) {
    const query = `
      SELECT * FROM video_sessions
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [patientId, limit]);
    return result.rows;
  },

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId, status, additionalData = {}) {
    const updates = ['status = $1'];
    const values = [status];
    let paramCounter = 2;

    if (additionalData.start_time) {
      updates.push(`start_time = $${paramCounter}`);
      values.push(additionalData.start_time);
      paramCounter++;
    }

    if (additionalData.end_time) {
      updates.push(`end_time = $${paramCounter}`);
      values.push(additionalData.end_time);
      paramCounter++;
    }

    if (additionalData.duration_minutes) {
      updates.push(`duration_minutes = $${paramCounter}`);
      values.push(additionalData.duration_minutes);
      paramCounter++;
    }

    updates.push(`updated_at = NOW()`);
    values.push(sessionId);

    const query = `
      UPDATE video_sessions
      SET ${updates.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *;
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Start a session
   */
  async startSession(sessionId) {
    return await this.updateSessionStatus(sessionId, 'started', {
      start_time: new Date()
    });
  },

  /**
   * End a session
   */
  async endSession(sessionId, durationMinutes = null) {
    const updateData = { end_time: new Date() };
    if (durationMinutes) {
      updateData.duration_minutes = durationMinutes;
    }

    return await this.updateSessionStatus(sessionId, 'ended', updateData);
  },

  /**
   * Cancel a session
   */
  async cancelSession(sessionId) {
    return await this.updateSessionStatus(sessionId, 'cancelled');
  },

  /**
   * Add participant to session
   */
  async addParticipant(sessionId, userId, userType) {
    const query = `
      INSERT INTO session_participants (session_id, user_id, user_type, joined_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (session_id, user_id)
      DO UPDATE SET joined_at = NOW()
      RETURNING *;
    `;

    const result = await pool.query(query, [sessionId, userId, userType]);
    return result.rows[0];
  },

  /**
   * Remove participant from session
   */
  async removeParticipant(sessionId, userId) {
    const query = `
      UPDATE session_participants
      SET left_at = NOW()
      WHERE session_id = $1 AND user_id = $2
      RETURNING *;
    `;

    const result = await pool.query(query, [sessionId, userId]);
    return result.rows[0];
  },

  /**
   * Get session participants
   */
  async getSessionParticipants(sessionId) {
    const query = `
      SELECT * FROM session_participants
      WHERE session_id = $1
      ORDER BY joined_at ASC;
    `;

    const result = await pool.query(query, [sessionId]);
    return result.rows;
  }
};

module.exports = sessionRepository;