const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class VideoIntegrationService {
  constructor() {
    this.jitsiDomain = process.env.JITSI_DOMAIN || 'meet.jit.si';
    this.jitsiAppId = process.env.JITSI_APP_ID;
    this.jitsiAppSecret = process.env.JITSI_APP_SECRET;
  }

  /**
   * Generate a unique room ID for the video session
   */
  generateRoomId(appointmentId, doctorId, patientId) {
    const timestamp = Date.now();
    const data = `${appointmentId}-${doctorId}-${patientId}-${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Generate meeting link for Jitsi
   */
  generateMeetingLink(roomId) {
    return `https://${this.jitsiDomain}/${roomId}`;
  }

  /**
   * Generate JWT token for Jitsi authentication (if app credentials are provided)
   */
  generateJitsiToken(roomId, userId, userName, userType) {
    if (!this.jitsiAppId || !this.jitsiAppSecret) {
      return null; // Return null if Jitsi authentication is not configured
    }

    const payload = {
      iss: this.jitsiAppId,
      sub: this.jitsiDomain,
      aud: 'jitsi',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      nbf: Math.floor(Date.now() / 1000) - 10,
      room: roomId,
      context: {
        user: {
          id: userId,
          name: userName,
          type: userType
        }
      }
    };

    return jwt.sign(payload, this.jitsiAppSecret, { algorithm: 'HS256' });
  }

  /**
   * Create a complete video session configuration
   */
  createVideoSession(appointmentId, doctorId, patientId, doctorName, patientName) {
    const roomId = this.generateRoomId(appointmentId, doctorId, patientId);
    const meetingLink = this.generateMeetingLink(roomId);

    // Generate tokens for both participants
    const doctorToken = this.generateJitsiToken(roomId, doctorId.toString(), doctorName, 'doctor');
    const patientToken = this.generateJitsiToken(roomId, patientId.toString(), patientName, 'patient');

    return {
      roomId,
      meetingLink,
      doctorToken,
      patientToken,
      jitsiDomain: this.jitsiDomain
    };
  }

  /**
   * Validate if a user can join a session
   */
  validateSessionAccess(session, userId, userType) {
    if (userType === 'doctor' && session.doctor_id !== userId) {
      return false;
    }
    if (userType === 'patient' && session.patient_id !== userId) {
      return false;
    }
    return true;
  }

  /**
   * Get session join URL with token
   */
  getJoinUrl(meetingLink, token = null) {
    if (token) {
      return `${meetingLink}?jwt=${token}`;
    }
    return meetingLink;
  }
}

module.exports = new VideoIntegrationService();