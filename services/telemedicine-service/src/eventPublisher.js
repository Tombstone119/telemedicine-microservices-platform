const amqp = require('amqplib');
require('dotenv').config();

class EventPublisher {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.connected = false;
  }

  async connect() {
    try {
      if (this.connected) return;

      const rabbitMQUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
      this.connection = await amqp.connect(rabbitMQUrl);
      this.channel = await this.connection.createChannel();

      // Declare exchange for telemedicine events
      await this.channel.assertExchange('telemedicine_events', 'topic', { durable: true });

      this.connected = true;
      console.log('✓ Connected to RabbitMQ for telemedicine event publishing');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publishEvent(eventType, data) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const event = {
        eventType,
        timestamp: new Date().toISOString(),
        service: 'telemedicine-service',
        data
      };

      const routingKey = `telemedicine.${eventType.toLowerCase()}`;

      await this.channel.publish(
        'telemedicine_events',
        routingKey,
        Buffer.from(JSON.stringify(event)),
        { persistent: true }
      );

      console.log(`📤 Published telemedicine event: ${eventType}`);
    } catch (error) {
      console.error('Failed to publish telemedicine event:', error);
      // Don't throw error to avoid breaking main flow
    }
  }

  async publishSessionCreated(sessionData) {
    await this.publishEvent('SessionCreated', {
      sessionId: sessionData.id,
      appointmentId: sessionData.appointment_id,
      doctorId: sessionData.doctor_id,
      patientId: sessionData.patient_id,
      roomId: sessionData.room_id,
      meetingLink: sessionData.meeting_link,
      createdAt: sessionData.created_at
    });
  }

  async publishSessionStarted(sessionData) {
    await this.publishEvent('SessionStarted', {
      sessionId: sessionData.id,
      appointmentId: sessionData.appointment_id,
      doctorId: sessionData.doctor_id,
      patientId: sessionData.patient_id,
      roomId: sessionData.room_id,
      startTime: sessionData.start_time
    });
  }

  async publishSessionEnded(sessionData) {
    await this.publishEvent('SessionEnded', {
      sessionId: sessionData.id,
      appointmentId: sessionData.appointment_id,
      doctorId: sessionData.doctor_id,
      patientId: sessionData.patient_id,
      roomId: sessionData.room_id,
      startTime: sessionData.start_time,
      endTime: sessionData.end_time,
      durationMinutes: sessionData.duration_minutes
    });
  }

  async publishSessionCancelled(sessionData) {
    await this.publishEvent('SessionCancelled', {
      sessionId: sessionData.id,
      appointmentId: sessionData.appointment_id,
      doctorId: sessionData.doctor_id,
      patientId: sessionData.patient_id,
      roomId: sessionData.room_id,
      cancelledAt: new Date().toISOString()
    });
  }

  async publishParticipantJoined(sessionId, participantData) {
    await this.publishEvent('ParticipantJoined', {
      sessionId,
      userId: participantData.user_id,
      userType: participantData.user_type,
      joinedAt: participantData.joined_at
    });
  }

  async publishParticipantLeft(sessionId, participantData) {
    await this.publishEvent('ParticipantLeft', {
      sessionId,
      userId: participantData.user_id,
      userType: participantData.user_type,
      joinedAt: participantData.joined_at,
      leftAt: participantData.left_at
    });
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.connected = false;
      console.log('✓ Disconnected from RabbitMQ');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }
}

// Create singleton instance
const eventPublisher = new EventPublisher();

// Graceful shutdown
process.on('SIGINT', async () => {
  await eventPublisher.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await eventPublisher.close();
  process.exit(0);
});

module.exports = eventPublisher;