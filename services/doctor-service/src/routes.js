const express = require('express');
const Joi = require('joi');
const { verifyToken, requireRole } = require('../../../shared/middleware/auth');
const { doctorModel, availabilityModel, leaveModel, appointmentModel, prescriptionModel } = require('./models');
const { validationSchemas, validate } = require('./validation');

const router = express.Router();

// ============ DOCTOR PROFILE ROUTES ============

// Get all doctors (public endpoint with optional filters)
router.get('/doctors', async (req, res) => {
  try {
    const { specialty, search, limit, offset } = req.query;

    const result = validate(
      { specialty, search, limit: limit ? parseInt(limit) : 20, offset: offset ? parseInt(offset) : 0 },
      validationSchemas.listFiltersSchema
    );

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    const doctors = await doctorModel.listDoctors(
      { specialty, search },
      result.value.limit,
      result.value.offset
    );

    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// Get doctor profile (authenticated)
router.get('/doctors/profile/:doctorId', verifyToken, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json({
      success: true,
      data: doctor
    });
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ error: 'Failed to fetch doctor profile' });
  }
});

// Get current user's doctor profile
router.get('/doctors/me', verifyToken, async (req, res) => {
  try {
    const doctor = await doctorModel.getDoctorByUserId(req.user.sub || req.user.id);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    res.json({
      success: true,
      data: doctor
    });
  } catch (error) {
    console.error('Error fetching current doctor profile:', error);
    res.status(500).json({ error: 'Failed to fetch doctor profile' });
  }
});

// Create doctor profile (admin or auth-service)
router.post('/doctors', verifyToken, requireRole('admin', 'doctor'), async (req, res) => {
  try {
    const result = validate(req.body, validationSchemas.createDoctorSchema);

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    // Check if doctor already exists
    const existingDoctor = await doctorModel.getDoctorByEmail(result.value.email);
    if (existingDoctor) {
      return res.status(409).json({ error: 'Doctor with this email already exists' });
    }

    const doctor = await doctorModel.createDoctor(result.value);

    res.status(201).json({
      success: true,
      message: 'Doctor profile created successfully',
      data: doctor
    });
  } catch (error) {
    console.error('Error creating doctor profile:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'License number already exists' });
    }
    res.status(500).json({ error: 'Failed to create doctor profile' });
  }
});

// Update doctor profile (doctor or admin)
router.put('/doctors/:doctorId', verifyToken, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized to update this profile' });
    }

    const result = validate(req.body, validationSchemas.updateDoctorSchema);

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    const updatedDoctor = await doctorModel.updateDoctor(parseInt(doctorId), result.value);

    res.json({
      success: true,
      message: 'Doctor profile updated successfully',
      data: updatedDoctor
    });
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).json({ error: 'Failed to update doctor profile' });
  }
});

// Delete doctor profile (admin only)
router.delete('/doctors/:doctorId', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    await doctorModel.deleteDoctor(parseInt(doctorId));

    res.json({
      success: true,
      message: 'Doctor profile deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting doctor profile:', error);
    res.status(500).json({ error: 'Failed to delete doctor profile' });
  }
});

// ============ AVAILABILITY ROUTES ============

// Get doctor availability schedule
router.get('/doctors/:doctorId/availability', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const availability = await availabilityModel.getDoctorAvailability(parseInt(doctorId));

    res.json({
      success: true,
      data: {
        doctor_id: doctorId,
        schedule: availability
      }
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Set availability for a day
router.post('/doctors/:doctorId/availability', verifyToken, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized to set availability' });
    }

    const result = validate(req.body, validationSchemas.availabilitySchema);

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    // Validate time range
    if (result.value.start_time >= result.value.end_time) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    const availability = await availabilityModel.setDayAvailability(
      parseInt(doctorId),
      result.value.day_of_week,
      result.value.start_time,
      result.value.end_time
    );

    res.status(201).json({
      success: true,
      message: 'Availability updated successfully',
      data: availability
    });
  } catch (error) {
    console.error('Error setting availability:', error);
    res.status(500).json({ error: 'Failed to set availability' });
  }
});

// Mark day as unavailable
router.post('/doctors/:doctorId/availability/unavailable', verifyToken, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { day_of_week } = req.body;

    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = validate(
      { day_of_week },
      Joi.object({
        day_of_week: Joi.string().valid(
          'Monday', 'Tuesday', 'Wednesday', 'Thursday',
          'Friday', 'Saturday', 'Sunday'
        ).required()
      })
    );

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    const availability = await availabilityModel.setDayUnavailable(
      parseInt(doctorId),
      result.value.day_of_week
    );

    res.json({
      success: true,
      message: 'Day marked as unavailable',
      data: availability
    });
  } catch (error) {
    console.error('Error marking day unavailable:', error);
    res.status(500).json({ error: 'Failed to mark day unavailable' });
  }
});

// Delete availability for a day
router.delete('/doctors/:doctorId/availability/:dayOfWeek', verifyToken, async (req, res) => {
  try {
    const { doctorId, dayOfWeek } = req.params;
    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await availabilityModel.deleteDayAvailability(parseInt(doctorId), dayOfWeek);

    res.json({
      success: true,
      message: 'Availability removed successfully'
    });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ error: 'Failed to delete availability' });
  }
});

// ============ LEAVE ROUTES ============

// Get doctor leaves
router.get('/doctors/:doctorId/leaves', verifyToken, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { from_date, to_date } = req.query;
    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const leaves = await leaveModel.getDoctorLeaves(
      parseInt(doctorId),
      from_date,
      to_date
    );

    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ error: 'Failed to fetch leaves' });
  }
});

// Add leave
router.post('/doctors/:doctorId/leaves', verifyToken, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = validate(req.body, validationSchemas.leaveSchema);

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    const leave = await leaveModel.addLeave(
      parseInt(doctorId),
      result.value.leave_date,
      result.value.reason
    );

    res.status(201).json({
      success: true,
      message: 'Leave added successfully',
      data: leave
    });
  } catch (error) {
    console.error('Error adding leave:', error);
    res.status(500).json({ error: 'Failed to add leave' });
  }
});

// Delete leave
router.delete('/doctors/:doctorId/leaves/:leaveDate', verifyToken, async (req, res) => {
  try {
    const { doctorId, leaveDate } = req.params;
    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await leaveModel.deleteLeave(parseInt(doctorId), leaveDate);

    res.json({
      success: true,
      message: 'Leave removed successfully'
    });
  } catch (error) {
    console.error('Error deleting leave:', error);
    res.status(500).json({ error: 'Failed to delete leave' });
  }
});

// ============ APPOINTMENT ROUTES ============

// Get doctor's appointments
router.get('/doctors/:doctorId/appointments', verifyToken, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status, date_from, date_to, limit } = req.query;

    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = validate(
      { status, date_from, date_to, limit: limit ? parseInt(limit) : 50 },
      validationSchemas.appointmentFiltersSchema
    );

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    const appointments = await appointmentModel.getDoctorAppointments(
      parseInt(doctorId),
      result.value
    );

    res.json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get specific appointment
router.get('/appointments/:appointmentId', verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await appointmentModel.getAppointmentById(parseInt(appointmentId));

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && appointment.doctor_id !== parseInt(req.params.doctorId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Accept appointment
router.put('/appointments/:appointmentId/accept', verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { notes } = req.body;

    const appointment = await appointmentModel.getAppointmentById(parseInt(appointmentId));
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check authorization
    const doctor = await doctorModel.getDoctorById(appointment.doctor_id);
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({ error: 'Appointment is not in pending status' });
    }

    const updatedAppointment = await appointmentModel.acceptAppointment(parseInt(appointmentId), notes);

    res.json({
      success: true,
      message: 'Appointment accepted successfully',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('Error accepting appointment:', error);
    res.status(500).json({ error: 'Failed to accept appointment' });
  }
});

// Reject appointment
router.put('/appointments/:appointmentId/reject', verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { notes } = req.body;

    const appointment = await appointmentModel.getAppointmentById(parseInt(appointmentId));
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check authorization
    const doctor = await doctorModel.getDoctorById(appointment.doctor_id);
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({ error: 'Appointment is not in pending status' });
    }

    const updatedAppointment = await appointmentModel.rejectAppointment(parseInt(appointmentId), notes);

    res.json({
      success: true,
      message: 'Appointment rejected successfully',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('Error rejecting appointment:', error);
    res.status(500).json({ error: 'Failed to reject appointment' });
  }
});

// Complete appointment
router.put('/appointments/:appointmentId/complete', verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { notes } = req.body;

    const appointment = await appointmentModel.getAppointmentById(parseInt(appointmentId));
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check authorization
    const doctor = await doctorModel.getDoctorById(appointment.doctor_id);
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (appointment.status !== 'accepted') {
      return res.status(400).json({ error: 'Appointment must be accepted before completion' });
    }

    const updatedAppointment = await appointmentModel.completeAppointment(parseInt(appointmentId), notes);

    res.json({
      success: true,
      message: 'Appointment completed successfully',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('Error completing appointment:', error);
    res.status(500).json({ error: 'Failed to complete appointment' });
  }
});

// ============ PRESCRIPTION ROUTES ============

// Create prescription
router.post('/prescriptions', verifyToken, async (req, res) => {
  try {
    const result = validate(req.body, validationSchemas.createPrescriptionSchema);

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    // Verify doctor authorization
    const doctor = await doctorModel.getDoctorById(result.value.doctor_id || req.body.doctor_id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // If appointment_id is provided, verify it belongs to the doctor
    if (result.value.appointment_id) {
      const appointment = await appointmentModel.getAppointmentById(result.value.appointment_id);
      if (!appointment || appointment.doctor_id !== doctor.id) {
        return res.status(400).json({ error: 'Invalid appointment for this doctor' });
      }
    }

    const prescriptionData = {
      ...result.value,
      doctor_id: doctor.id
    };

    const prescription = await prescriptionModel.createPrescription(prescriptionData);

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: prescription
    });
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

// Get prescription by ID
router.get('/prescriptions/:prescriptionId', verifyToken, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const prescription = await prescriptionModel.getPrescriptionById(parseInt(prescriptionId));

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    // Check authorization (doctor can view their own prescriptions, patients can view their own)
    const doctor = await doctorModel.getDoctorById(prescription.doctor_id);
    const isDoctor = req.user.role !== 'admin' && doctor.user_id === (req.user.sub || req.user.id);
    const isPatient = prescription.patient_id === req.user.patient_id; // Assuming patient_id is in token

    if (!isDoctor && !isPatient && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({ error: 'Failed to fetch prescription' });
  }
});

// Get doctor's prescriptions
router.get('/doctors/:doctorId/prescriptions', verifyToken, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { limit } = req.query;

    const doctor = await doctorModel.getDoctorById(parseInt(doctorId));
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && doctor.user_id !== (req.user.sub || req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const prescriptions = await prescriptionModel.getPrescriptionsByDoctor(
      parseInt(doctorId),
      limit ? parseInt(limit) : 50
    );

    res.json({
      success: true,
      data: prescriptions
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

module.exports = router;
