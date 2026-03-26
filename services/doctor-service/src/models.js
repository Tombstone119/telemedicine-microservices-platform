const pool = require('./db');

// Doctor Profile Management
const doctorModel = {
  // Create a new doctor profile
  async createDoctor(doctorData) {
    const {
      user_id, first_name, last_name, email, phone, specialty,
      bio, license_number, license_expiry, experience_years,
      education, hospital_affiliation, consultation_fee, languages
    } = doctorData;

    const query = `
      INSERT INTO doctors (
        user_id, first_name, last_name, email, phone, specialty,
        bio, license_number, license_expiry, experience_years,
        education, hospital_affiliation, consultation_fee, languages
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

    const values = [
      user_id, first_name, last_name, email, phone, specialty,
      bio, license_number, license_expiry, experience_years,
      JSON.stringify(education || []), hospital_affiliation,
      consultation_fee, JSON.stringify(languages || ['English'])
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Get doctor profile by ID
  async getDoctorById(doctorId) {
    const query = `
      SELECT * FROM doctors WHERE id = $1;
    `;
    const result = await pool.query(query, [doctorId]);
    return result.rows[0];
  },

  // Get doctor profile by user_id
  async getDoctorByUserId(userId) {
    const query = `
      SELECT * FROM doctors WHERE user_id = $1;
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  },

  // Get doctor profile by email
  async getDoctorByEmail(email) {
    const query = `
      SELECT * FROM doctors WHERE email = $1;
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0];
  },

  // Update doctor profile
  async updateDoctor(doctorId, updates) {
    const allowedFields = [
      'first_name', 'last_name', 'phone', 'specialty', 'bio',
      'license_expiry', 'experience_years', 'education',
      'hospital_affiliation', 'consultation_fee', 'languages',
      'avatar_url', 'is_active'
    ];

    const updates_array = [];
    const values = [];
    let paramCounter = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const actualValue = ['education', 'languages'].includes(key)
          ? JSON.stringify(value)
          : value;
        updates_array.push(`${key} = $${paramCounter}`);
        values.push(actualValue);
        paramCounter++;
      }
    }

    if (updates_array.length === 0) {
      return await this.getDoctorById(doctorId);
    }

    updates_array.push(`updated_at = NOW()`);
    values.push(doctorId);

    const query = `
      UPDATE doctors
      SET ${updates_array.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *;
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // List all doctors with optional filters
  async listDoctors(filters = {}, limit = 20, offset = 0) {
    let query = 'SELECT * FROM doctors WHERE is_active = true';
    const values = [];
    let paramCounter = 1;

    if (filters.specialty) {
      query += ` AND specialty = $${paramCounter}`;
      values.push(filters.specialty);
      paramCounter++;
    }

    if (filters.search) {
      query += ` AND (first_name ILIKE $${paramCounter} OR last_name ILIKE $${paramCounter} OR email ILIKE $${paramCounter})`;
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm);
      paramCounter++;
      values.push(searchTerm);
      paramCounter++;
      values.push(searchTerm);
      paramCounter++;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as count_query`, values);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY created_at DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return {
      doctors: result.rows,
      total,
      limit,
      offset,
      pages: Math.ceil(total / limit)
    };
  },

  // Delete doctor profile (soft delete)
  async deleteDoctor(doctorId) {
    const query = `
      UPDATE doctors
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [doctorId]);
    return result.rows[0];
  }
};

// Doctor Availability Management
const availabilityModel = {
  // Set availability for a specific day
  async setDayAvailability(doctorId, dayOfWeek, startTime, endTime) {
    const query = `
      INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (doctor_id, day_of_week)
      DO UPDATE SET start_time = $3, end_time = $4, updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [doctorId, dayOfWeek, startTime, endTime]);
    return result.rows[0];
  },

  // Get doctor's availability schedule
  async getDoctorAvailability(doctorId) {
    const query = `
      SELECT * FROM doctor_availability
      WHERE doctor_id = $1
      ORDER BY
        CASE day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END;
    `;
    const result = await pool.query(query, [doctorId]);
    return result.rows;
  },

  // Mark day as unavailable
  async setDayUnavailable(doctorId, dayOfWeek) {
    const query = `
      INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, is_available)
      VALUES ($1, $2, '00:00:00', '00:00:00', false)
      ON CONFLICT (doctor_id, day_of_week)
      DO UPDATE SET is_available = false, updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [doctorId, dayOfWeek]);
    return result.rows[0];
  },

  // Delete availability for a day
  async deleteDayAvailability(doctorId, dayOfWeek) {
    const query = `
      DELETE FROM doctor_availability
      WHERE doctor_id = $1 AND day_of_week = $2
      RETURNING *;
    `;
    const result = await pool.query(query, [doctorId, dayOfWeek]);
    return result.rows[0];
  }
};

// Doctor Leaves Management
const leaveModel = {
  // Add a leave date
  async addLeave(doctorId, leaveDate, reason) {
    const query = `
      INSERT INTO doctor_leaves (doctor_id, leave_date, reason)
      VALUES ($1, $2, $3)
      ON CONFLICT (doctor_id, leave_date)
      DO UPDATE SET reason = $3, created_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [doctorId, leaveDate, reason]);
    return result.rows[0];
  },

  // Get doctor leaves
  async getDoctorLeaves(doctorId, fromDate = null, toDate = null) {
    let query = 'SELECT * FROM doctor_leaves WHERE doctor_id = $1';
    const values = [doctorId];
    let paramCounter = 2;

    if (fromDate) {
      query += ` AND leave_date >= $${paramCounter}`;
      values.push(fromDate);
      paramCounter++;
    }

    if (toDate) {
      query += ` AND leave_date <= $${paramCounter}`;
      values.push(toDate);
      paramCounter++;
    }

    query += ' ORDER BY leave_date DESC';
    const result = await pool.query(query, values);
    return result.rows;
  },

  // Check if date is a leave
  async isLeaveDate(doctorId, date) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM doctor_leaves
        WHERE doctor_id = $1 AND leave_date = $2
      );
    `;
    const result = await pool.query(query, [doctorId, date]);
    return result.rows[0].exists;
  },

  // Delete leave
  async deleteLeave(doctorId, leaveDate) {
    const query = `
      DELETE FROM doctor_leaves
      WHERE doctor_id = $1 AND leave_date = $2
      RETURNING *;
    `;
    const result = await pool.query(query, [doctorId, leaveDate]);
    return result.rows[0];
  }
};

module.exports = {
  doctorModel,
  availabilityModel,
  leaveModel
};
