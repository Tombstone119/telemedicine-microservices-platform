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

      // Declare exchange for events
      await this.channel.assertExchange('doctor_events', 'topic', { durable: true });

      this.connected = true;
      console.log('✓ Connected to RabbitMQ for event publishing');
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
        service: 'doctor-service',
        data
      };

      const routingKey = `doctor.${eventType.toLowerCase()}`;

      await this.channel.publish(
        'doctor_events',
        routingKey,
        Buffer.from(JSON.stringify(event)),
        { persistent: true }
      );

      console.log(`📤 Published event: ${eventType}`);
    } catch (error) {
      console.error('Failed to publish event:', error);
      // Don't throw error to avoid breaking main flow
    }
  }

  async publishDoctorRegistered(doctorData) {
    await this.publishEvent('DoctorRegistered', {
      doctorId: doctorData.id,
      userId: doctorData.user_id,
      email: doctorData.email,
      specialty: doctorData.specialty,
      licenseNumber: doctorData.license_number
    });
  }

  async publishAppointmentAccepted(appointmentData) {
    await this.publishEvent('AppointmentAccepted', {
      appointmentId: appointmentData.id,
      doctorId: appointmentData.doctor_id,
      patientId: appointmentData.patient_id,
      appointmentDate: appointmentData.appointment_date,
      appointmentTime: appointmentData.appointment_time
    });
  }

  async publishAppointmentRejected(appointmentData) {
    await this.publishEvent('AppointmentRejected', {
      appointmentId: appointmentData.id,
      doctorId: appointmentData.doctor_id,
      patientId: appointmentData.patient_id,
      reason: appointmentData.notes
    });
  }

  async publishAppointmentCompleted(appointmentData) {
    await this.publishEvent('AppointmentCompleted', {
      appointmentId: appointmentData.id,
      doctorId: appointmentData.doctor_id,
      patientId: appointmentData.patient_id,
      completedAt: new Date().toISOString()
    });
  }

  async publishPrescriptionIssued(prescriptionData) {
    await this.publishEvent('PrescriptionIssued', {
      prescriptionId: prescriptionData.id,
      appointmentId: prescriptionData.appointment_id,
      doctorId: prescriptionData.doctor_id,
      patientId: prescriptionData.patient_id,
      medicinesCount: Array.isArray(prescriptionData.medicines) ? prescriptionData.medicines.length : 0,
      issuedDate: prescriptionData.issued_date
    });
  }

  async publishDoctorProfileUpdated(doctorData) {
    await this.publishEvent('DoctorProfileUpdated', {
      doctorId: doctorData.id,
      userId: doctorData.user_id,
      updatedFields: Object.keys(doctorData).filter(key =>
        !['id', 'created_at', 'updated_at'].includes(key)
      )
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