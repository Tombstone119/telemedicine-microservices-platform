const express = require('express');
const sessionService = require('./sessionService');
const securityService = require('./securityService');
const notificationService = require('./notificationService');
const eventPublisher = require('./eventPublisher');
const { validationSchemas, validate } = require('./validation');

const router = express.Router();

// ============ SESSION CONTROLLER ROUTES ============

// Create video session for appointment
router.post('/sessions/create', securityService.authenticate, async (req, res) => {
  try {
    const result = validate(req.body, validationSchemas.createSessionSchema);

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    const { appointment_id, doctor_name, patient_name } = result.value;
    const user = req.user;

    // Validate appointment and user authorization
    const appointment = await sessionService.validateAppointmentForSession(
      appointment_id, user.id, user.type
    );

    // Create video session
    const session = await sessionService.createSessionForAppointment(
      appointment_id,
      appointment.doctor_id,
      appointment.patient_id,
      doctor_name,
      patient_name
    );

    // Publish event
    try {
      await eventPublisher.publishSessionCreated(session);
    } catch (error) {
      console.error('Failed to publish session created event:', error);
    }

    // Send notifications (this would need email addresses from user data)
    // For now, we'll skip this as we don't have user email data in this context

    res.status(201).json({
      success: true,
      message: 'Video session created successfully',
      data: {
        session_id: session.id,
        room_id: session.room_id,
        meeting_link: session.meeting_link,
        doctor_token: session.jitsi_token,
        patient_token: session.patient_token,
        status: session.status
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create video session' });
  }
});

// Get session by appointment ID
router.get('/sessions/appointment/:appointmentId', securityService.authenticate, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const user = req.user;

    // Validate appointment access
    await sessionService.validateAppointmentForSession(appointmentId, user.id, user.type);

    const session = await sessionService.getSessionByAppointmentId(appointmentId);

    if (!session) {
      return res.status(404).json({ error: 'Video session not found for this appointment' });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch video session' });
  }
});

// Get session by ID
router.get('/sessions/:sessionId', securityService.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = req.user;

    const session = await sessionService.getSessionByAppointmentId(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Video session not found' });
    }

    // Validate access
    if (!securityService.validateSessionAccess(session, user.id, user.type)) {
      return res.status(403).json({ error: 'Unauthorized to access this session' });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch video session' });
  }
});

// Get join URL for session
router.get('/sessions/:sessionId/join', securityService.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = req.user;

    const joinUrl = await sessionService.getJoinUrl(sessionId, user.id, user.type);

    res.json({
      success: true,
      data: {
        join_url: joinUrl,
        session_id: sessionId
      }
    });
  } catch (error) {
    console.error('Error getting join URL:', error);
    res.status(500).json({ error: 'Failed to get join URL' });
  }
});

// Start session
router.post('/sessions/:sessionId/start', securityService.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = req.user;

    const session = await sessionService.startSession(sessionId, user.id, user.type);

    // Publish event
    try {
      await eventPublisher.publishSessionStarted(session);
    } catch (error) {
      console.error('Failed to publish session started event:', error);
    }

    // Send notifications
    try {
      const participants = await sessionService.getSessionByAppointmentId(session.appointment_id);
      await notificationService.sendSessionStartedNotification(session, participants.participants || []);
    } catch (error) {
      console.error('Failed to send session started notifications:', error);
    }

    res.json({
      success: true,
      message: 'Session started successfully',
      data: session
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// End session
router.post('/sessions/:sessionId/end', securityService.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = req.user;

    const session = await sessionService.endSession(sessionId, user.id, user.type);

    // Publish event
    try {
      await eventPublisher.publishSessionEnded(session);
    } catch (error) {
      console.error('Failed to publish session ended event:', error);
    }

    // Send notifications
    try {
      const participants = await sessionService.getSessionByAppointmentId(session.appointment_id);
      await notificationService.sendSessionEndedNotification(
        session,
        participants.participants || [],
        session.duration_minutes
      );
    } catch (error) {
      console.error('Failed to send session ended notifications:', error);
    }

    res.json({
      success: true,
      message: 'Session ended successfully',
      data: session
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Join session (add participant)
router.post('/sessions/:sessionId/join', securityService.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { user_type } = req.body;
    const user = req.user;

    const result = validate({ user_type }, validationSchemas.joinSessionSchema);

    if (!result.valid) {
      return res.status(400).json({ errors: result.messages });
    }

    // Add participant
    const participant = await sessionService.sessionRepository.addParticipant(
      sessionId,
      user.id,
      user_type
    );

    // Publish event
    try {
      await eventPublisher.publishParticipantJoined(sessionId, participant);
    } catch (error) {
      console.error('Failed to publish participant joined event:', error);
    }

    res.json({
      success: true,
      message: 'Successfully joined session',
      data: participant
    });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// Leave session (remove participant)
router.post('/sessions/:sessionId/leave', securityService.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = req.user;

    const participant = await sessionService.sessionRepository.removeParticipant(
      sessionId,
      user.id
    );

    // Publish event
    try {
      await eventPublisher.publishParticipantLeft(sessionId, participant);
    } catch (error) {
      console.error('Failed to publish participant left event:', error);
    }

    res.json({
      success: true,
      message: 'Successfully left session',
      data: participant
    });
  } catch (error) {
    console.error('Error leaving session:', error);
    res.status(500).json({ error: 'Failed to leave session' });
  }
});

// Get session participants
router.get('/sessions/:sessionId/participants', securityService.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = req.user;

    // Validate session access
    const session = await sessionService.sessionRepository.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!securityService.validateSessionAccess(session, user.id, user.type)) {
      return res.status(403).json({ error: 'Unauthorized to view session participants' });
    }

    const participants = await sessionService.sessionRepository.getSessionParticipants(sessionId);

    res.json({
      success: true,
      data: participants
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

module.exports = router;