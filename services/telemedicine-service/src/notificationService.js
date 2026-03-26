const axios = require('axios');

class NotificationService {
  constructor() {
    this.notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006';
  }

  /**
   * Send session invitation to doctor
   */
  async sendSessionInvitationToDoctor(session, doctorEmail, doctorName, patientName) {
    try {
      const message = {
        to: doctorEmail,
        subject: 'Video Consultation Session Created',
        template: 'session_invitation_doctor',
        data: {
          doctorName,
          patientName,
          meetingLink: session.meeting_link,
          roomId: session.room_id,
          appointmentId: session.appointment_id,
          scheduledTime: new Date().toLocaleString()
        }
      };

      await this.sendEmail(message);
      console.log(`Session invitation sent to doctor: ${doctorEmail}`);
    } catch (error) {
      console.error('Failed to send session invitation to doctor:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Send session invitation to patient
   */
  async sendSessionInvitationToPatient(session, patientEmail, patientName, doctorName) {
    try {
      const message = {
        to: patientEmail,
        subject: 'Your Video Consultation is Ready',
        template: 'session_invitation_patient',
        data: {
          patientName,
          doctorName,
          meetingLink: session.meeting_link,
          roomId: session.room_id,
          appointmentId: session.appointment_id,
          instructions: 'Please click the link to join your consultation at the scheduled time.'
        }
      };

      await this.sendEmail(message);
      console.log(`Session invitation sent to patient: ${patientEmail}`);
    } catch (error) {
      console.error('Failed to send session invitation to patient:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Send session reminder
   */
  async sendSessionReminder(session, email, name, userType, minutesUntilSession = 15) {
    try {
      const message = {
        to: email,
        subject: `Video Consultation Reminder - ${minutesUntilSession} minutes`,
        template: 'session_reminder',
        data: {
          name,
          userType: userType === 'doctor' ? 'Dr.' : '',
          meetingLink: session.meeting_link,
          roomId: session.room_id,
          minutesUntilSession
        }
      };

      await this.sendEmail(message);
      console.log(`Session reminder sent to ${userType}: ${email}`);
    } catch (error) {
      console.error('Failed to send session reminder:', error);
    }
  }

  /**
   * Send session started notification
   */
  async sendSessionStartedNotification(session, participants) {
    try {
      // Notify all participants that session has started
      for (const participant of participants) {
        if (participant.user_type === 'doctor' || participant.user_type === 'patient') {
          const message = {
            to: participant.email, // This would need to be fetched
            subject: 'Video Consultation Started',
            template: 'session_started',
            data: {
              name: participant.name,
              meetingLink: session.meeting_link,
              roomId: session.room_id
            }
          };

          await this.sendEmail(message);
        }
      }
    } catch (error) {
      console.error('Failed to send session started notifications:', error);
    }
  }

  /**
   * Send session ended notification
   */
  async sendSessionEndedNotification(session, participants, duration) {
    try {
      for (const participant of participants) {
        if (participant.user_type === 'doctor' || participant.user_type === 'patient') {
          const message = {
            to: participant.email,
            subject: 'Video Consultation Completed',
            template: 'session_ended',
            data: {
              name: participant.name,
              duration: duration || 'N/A',
              roomId: session.room_id,
              nextSteps: 'Please complete any necessary follow-up actions.'
            }
          };

          await this.sendEmail(message);
        }
      }
    } catch (error) {
      console.error('Failed to send session ended notifications:', error);
    }
  }

  /**
   * Send SMS notification (if needed)
   */
  async sendSMS(phoneNumber, message) {
    try {
      const smsData = {
        to: phoneNumber,
        message: message,
        type: 'session_notification'
      };

      await axios.post(`${this.notificationServiceUrl}/api/notifications/sms`, smsData);
      console.log(`SMS sent to: ${phoneNumber}`);
    } catch (error) {
      console.error('Failed to send SMS:', error);
    }
  }

  /**
   * Send email via notification service
   */
  async sendEmail(emailData) {
    try {
      await axios.post(`${this.notificationServiceUrl}/api/notifications/email`, emailData);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send push notification (if supported)
   */
  async sendPushNotification(userId, title, body, data = {}) {
    try {
      const pushData = {
        userId,
        title,
        body,
        data: {
          type: 'session_notification',
          ...data
        }
      };

      await axios.post(`${this.notificationServiceUrl}/api/notifications/push`, pushData);
      console.log(`Push notification sent to user: ${userId}`);
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }
}

module.exports = new NotificationService();