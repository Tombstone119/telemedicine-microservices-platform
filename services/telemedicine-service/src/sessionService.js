const sessionRepository = require('./sessionRepository');
const videoIntegration = require('./videoIntegration');
const axios = require('axios');

class SessionService {
  constructor() {
    this.appointmentServiceUrl = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3003';
  }

  /**
   * Create a video session for an appointment
   */
  async createSessionForAppointment(appointmentId, doctorId, patientId, doctorName, patientName) {
    try {
      // Check if session already exists for this appointment
      const existingSession = await sessionRepository.getSessionByAppointmentId(appointmentId);
      if (existingSession) {
        throw new Error('Video session already exists for this appointment');
      }

      // Create video session configuration
      const videoConfig = videoIntegration.createVideoSession(
        appointmentId, doctorId, patientId, doctorName, patientName
      );

      // Create session in database
      const sessionData = {
        appointment_id: appointmentId,
        doctor_id: doctorId,
        patient_id: patientId,
        room_id: videoConfig.roomId,
        meeting_link: videoConfig.meetingLink,
        jitsi_token: videoConfig.doctorToken, // Store doctor's token as primary
        status: 'created'
      };

      const session = await sessionRepository.createSession(sessionData);

      return {
        ...session,
        patient_token: videoConfig.patientToken,
        jitsi_domain: videoConfig.jitsiDomain
      };
    } catch (error) {
      console.error('Error creating session for appointment:', error);
      throw error;
    }
  }

  /**
   * Get session by appointment ID
   */
  async getSessionByAppointmentId(appointmentId) {
    try {
      const session = await sessionRepository.getSessionByAppointmentId(appointmentId);
      if (!session) {
        return null;
      }

      // Get participants
      const participants = await sessionRepository.getSessionParticipants(session.id);

      return {
        ...session,
        participants
      };
    } catch (error) {
      console.error('Error getting session by appointment ID:', error);
      throw error;
    }
  }

  /**
   * Start a video session
   */
  async startSession(sessionId, userId, userType) {
    try {
      const session = await sessionRepository.getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Validate access
      if (!videoIntegration.validateSessionAccess(session, userId, userType)) {
        throw new Error('Unauthorized to start this session');
      }

      // Add participant
      await sessionRepository.addParticipant(sessionId, userId, userType);

      // Start session if not already started
      if (session.status === 'created') {
        await sessionRepository.startSession(sessionId);
      }

      return await sessionRepository.getSessionById(sessionId);
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    }
  }

  /**
   * End a video session
   */
  async endSession(sessionId, userId, userType) {
    try {
      const session = await sessionRepository.getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Validate access
      if (!videoIntegration.validateSessionAccess(session, userId, userType)) {
        throw new Error('Unauthorized to end this session');
      }

      // Remove participant
      await sessionRepository.removeParticipant(sessionId, userId);

      // Calculate duration if session was started
      let durationMinutes = null;
      if (session.start_time) {
        const endTime = new Date();
        const startTime = new Date(session.start_time);
        durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
      }

      // End session
      await sessionRepository.endSession(sessionId, durationMinutes);

      return await sessionRepository.getSessionById(sessionId);
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  /**
   * Get join URL for a session
   */
  async getJoinUrl(sessionId, userId, userType) {
    try {
      const session = await sessionRepository.getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Validate access
      if (!videoIntegration.validateSessionAccess(session, userId, userType)) {
        throw new Error('Unauthorized to join this session');
      }

      // Generate user-specific token
      let token = null;
      if (userType === 'doctor') {
        token = videoIntegration.generateJitsiToken(
          session.room_id,
          userId.toString(),
          'Doctor', // This should be fetched from user data
          'doctor'
        );
      } else if (userType === 'patient') {
        token = videoIntegration.generateJitsiToken(
          session.room_id,
          userId.toString(),
          'Patient', // This should be fetched from user data
          'patient'
        );
      }

      return videoIntegration.getJoinUrl(session.meeting_link, token);
    } catch (error) {
      console.error('Error getting join URL:', error);
      throw error;
    }
  }

  /**
   * Get appointment details from appointment service
   */
  async getAppointmentDetails(appointmentId) {
    try {
      const response = await axios.get(`${this.appointmentServiceUrl}/api/appointments/${appointmentId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching appointment details:', error);
      throw new Error('Failed to fetch appointment details');
    }
  }

  /**
   * Validate appointment before creating session
   */
  async validateAppointmentForSession(appointmentId, userId, userType) {
    try {
      const appointment = await this.getAppointmentDetails(appointmentId);

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      if (appointment.status !== 'accepted') {
        throw new Error('Appointment must be accepted before creating video session');
      }

      // Check if user is authorized (doctor or patient of the appointment)
      if (userType === 'doctor' && appointment.doctor_id !== userId) {
        throw new Error('Unauthorized: Not the assigned doctor');
      }

      if (userType === 'patient' && appointment.patient_id !== userId) {
        throw new Error('Unauthorized: Not the assigned patient');
      }

      return appointment;
    } catch (error) {
      console.error('Error validating appointment:', error);
      throw error;
    }
  }
}

module.exports = new SessionService();