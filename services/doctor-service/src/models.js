const pool = require('./db');
const eventPublisher = require('./eventPublisher');

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
    const doctor = result.rows[0];

    // Publish event
    try {
      await eventPublisher.publishDoctorRegistered(doctor);
    } catch (error) {
      console.error('Failed to publish doctor registered event:', error);
    }

    return doctor;
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
    const updatedDoctor = result.rows[0];

    // Publish event
    try {
      await eventPublisher.publishDoctorProfileUpdated(updatedDoctor);
    } catch (error) {
      console.error('Failed to publish doctor profile updated event:', error);
    }

    return updatedDoctor;
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

// Appointment Management
const appointmentModel = {
  // Create a new appointment
  async createAppointment(appointmentData) {
    const {
      doctor_id, patient_id, appointment_date, appointment_time,
      duration_minutes, symptoms, notes, consultation_fee
    } = appointmentData;

    const query = `
      INSERT INTO appointments (
        doctor_id, patient_id, appointment_date, appointment_time,
        duration_minutes, symptoms, notes, consultation_fee
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const values = [
      doctor_id, patient_id, appointment_date, appointment_time,
      duration_minutes || 30, symptoms, notes, consultation_fee
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Get appointment by ID
  async getAppointmentById(appointmentId) {
    const query = `
      SELECT a.*, d.first_name as doctor_first_name, d.last_name as doctor_last_name,
             d.specialty, d.consultation_fee as default_fee
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = $1;
    `;
    const result = await pool.query(query, [appointmentId]);
    return result.rows[0];
  },

  // Get doctor's appointments
  async getDoctorAppointments(doctorId, filters = {}) {
    let query = `
      SELECT a.*, d.first_name, d.last_name, d.specialty
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.doctor_id = $1
    `;
    const values = [doctorId];
    let paramCounter = 2;

    if (filters.status) {
      query += ` AND a.status = $${paramCounter}`;
      values.push(filters.status);
      paramCounter++;
    }

    if (filters.date_from) {
      query += ` AND a.appointment_date >= $${paramCounter}`;
      values.push(filters.date_from);
      paramCounter++;
    }

    if (filters.date_to) {
      query += ` AND a.appointment_date <= $${paramCounter}`;
      values.push(filters.date_to);
      paramCounter++;
    }

    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramCounter}`;
      values.push(filters.limit);
      paramCounter++;
    }

    const result = await pool.query(query, values);
    return result.rows;
  },

  // Update appointment status
  async updateAppointmentStatus(appointmentId, status, notes = null) {
    const query = `
      UPDATE appointments
      SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const result = await pool.query(query, [status, notes, appointmentId]);
    const appointment = result.rows[0];

    // Publish event based on status
    try {
      switch (status) {
        case 'accepted':
          await eventPublisher.publishAppointmentAccepted(appointment);
          break;
        case 'rejected':
          await eventPublisher.publishAppointmentRejected(appointment);
          break;
        case 'completed':
          await eventPublisher.publishAppointmentCompleted(appointment);
          break;
      }
    } catch (error) {
      console.error(`Failed to publish appointment ${status} event:`, error);
    }

    return appointment;
  },

  // Accept appointment
  async acceptAppointment(appointmentId, notes = null) {
    return await this.updateAppointmentStatus(appointmentId, 'accepted', notes);
  },

  // Reject appointment
  async rejectAppointment(appointmentId, notes = null) {
    return await this.updateAppointmentStatus(appointmentId, 'rejected', notes);
  },

  // Complete appointment
  async completeAppointment(appointmentId, notes = null) {
    return await this.updateAppointmentStatus(appointmentId, 'completed', notes);
  },

  // Cancel appointment
  async cancelAppointment(appointmentId, notes = null) {
    return await this.updateAppointmentStatus(appointmentId, 'cancelled', notes);
  }
};

// Prescription Management
const prescriptionModel = {
  // Create a new prescription
  async createPrescription(prescriptionData) {
    const {
      appointment_id, doctor_id, patient_id, medicines,
      dosage_instructions, notes, valid_until
    } = prescriptionData;

    const query = `
      INSERT INTO prescriptions (
        appointment_id, doctor_id, patient_id, medicines,
        dosage_instructions, notes, valid_until
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [
      appointment_id, doctor_id, patient_id, JSON.stringify(medicines),
      dosage_instructions, notes, valid_until
    ];

    const result = await pool.query(query, values);
    const prescription = result.rows[0];

    // Insert individual medicines if provided as array
    if (Array.isArray(medicines)) {
      for (const medicine of medicines) {
        await pool.query(`
          INSERT INTO prescription_medicines (
            prescription_id, medicine_name, dosage, frequency, duration_days, instructions
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          prescription.id,
          medicine.name || medicine.medicine_name,
          medicine.dosage,
          medicine.frequency,
          medicine.duration_days,
          medicine.instructions
        ]);
      }
    }

    // Publish event
    try {
      await eventPublisher.publishPrescriptionIssued(prescription);
    } catch (error) {
      console.error('Failed to publish prescription issued event:', error);
    }

    return prescription;
  },

  // Get prescription by ID
  async getPrescriptionById(prescriptionId) {
    const query = `
      SELECT p.*, d.first_name as doctor_first_name, d.last_name as doctor_last_name,
             d.specialty, d.license_number,
             pm.medicine_name, pm.dosage, pm.frequency, pm.duration_days, pm.instructions
      FROM prescriptions p
      JOIN doctors d ON p.doctor_id = d.id
      LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
      WHERE p.id = $1;
    `;
    const result = await pool.query(query, [prescriptionId]);

    if (result.rows.length === 0) return null;

    const prescription = {
      id: result.rows[0].id,
      appointment_id: result.rows[0].appointment_id,
      doctor_id: result.rows[0].doctor_id,
      patient_id: result.rows[0].patient_id,
      medicines: result.rows[0].medicines,
      dosage_instructions: result.rows[0].dosage_instructions,
      notes: result.rows[0].notes,
      issued_date: result.rows[0].issued_date,
      valid_until: result.rows[0].valid_until,
      doctor: {
        first_name: result.rows[0].doctor_first_name,
        last_name: result.rows[0].doctor_last_name,
        specialty: result.rows[0].specialty,
        license_number: result.rows[0].license_number
      },
      medicine_details: result.rows.map(row => ({
        medicine_name: row.medicine_name,
        dosage: row.dosage,
        frequency: row.frequency,
        duration_days: row.duration_days,
        instructions: row.instructions
      })).filter(item => item.medicine_name)
    };

    return prescription;
  },

  // Get prescriptions by doctor
  async getPrescriptionsByDoctor(doctorId, limit = 50) {
    const query = `
      SELECT p.*, d.first_name, d.last_name, d.specialty
      FROM prescriptions p
      JOIN doctors d ON p.doctor_id = d.id
      WHERE p.doctor_id = $1
      ORDER BY p.issued_date DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [doctorId, limit]);
    return result.rows;
  },

  // Get prescriptions by patient
  async getPrescriptionsByPatient(patientId, limit = 50) {
    const query = `
      SELECT p.*, d.first_name, d.last_name, d.specialty
      FROM prescriptions p
      JOIN doctors d ON p.doctor_id = d.id
      WHERE p.patient_id = $1
      ORDER BY p.issued_date DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [patientId, limit]);
    return result.rows;
  }
};

module.exports = {
  doctorModel,
  availabilityModel,
  leaveModel,
  appointmentModel,
  prescriptionModel
};
