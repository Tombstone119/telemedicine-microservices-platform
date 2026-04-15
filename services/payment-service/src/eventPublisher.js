const amqp = require('amqplib');

class EventPublisher {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.exchange = 'telemedicine_events';
    this.exchangeType = 'topic';
  }

  /**
   * Initialize RabbitMQ connection
   */
  async initialize() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Declare exchange
      await this.channel.assertExchange(this.exchange, this.exchangeType, { durable: true });

      console.log('Payment service event publisher initialized');
    } catch (error) {
      console.error('Failed to initialize event publisher:', error);
      throw error;
    }
  }

  /**
   * Publish payment initiated event
   */
  async publishPaymentInitiated(eventData) {
    await this.publishEvent('payment.initiated', {
      paymentId: eventData.paymentId,
      appointmentId: eventData.appointmentId,
      patientId: eventData.patientId,
      doctorId: eventData.doctorId,
      amount: eventData.amount,
      currency: eventData.currency,
      paymentMethod: eventData.paymentMethod,
      initiatedAt: new Date().toISOString()
    });
  }

  /**
   * Publish payment completed event
   */
  async publishPaymentCompleted(eventData) {
    await this.publishEvent('payment.completed', {
      paymentId: eventData.paymentId,
      appointmentId: eventData.appointmentId,
      patientId: eventData.patientId,
      doctorId: eventData.doctorId,
      amount: eventData.amount,
      currency: eventData.currency,
      transactionId: eventData.transactionId,
      paidAt: eventData.paidAt || new Date().toISOString()
    });
  }

  /**
   * Publish payment failed event
   */
  async publishPaymentFailed(eventData) {
    await this.publishEvent('payment.failed', {
      paymentId: eventData.paymentId,
      appointmentId: eventData.appointmentId,
      patientId: eventData.patientId,
      doctorId: eventData.doctorId,
      amount: eventData.amount,
      currency: eventData.currency,
      reason: eventData.reason,
      failedAt: new Date().toISOString()
    });
  }

  /**
   * Publish payment refunded event
   */
  async publishPaymentRefunded(eventData) {
    await this.publishEvent('payment.refunded', {
      paymentId: eventData.paymentId,
      refundId: eventData.refundId,
      appointmentId: eventData.appointmentId,
      amount: eventData.amount,
      currency: eventData.currency,
      reason: eventData.reason,
      refundedAt: new Date().toISOString()
    });
  }

  /**
   * Publish invoice generated event
   */
  async publishInvoiceGenerated(eventData) {
    await this.publishEvent('invoice.generated', {
      invoiceId: eventData.invoiceId,
      paymentId: eventData.paymentId,
      appointmentId: eventData.appointmentId,
      patientId: eventData.patientId,
      doctorId: eventData.doctorId,
      amount: eventData.amount,
      currency: eventData.currency,
      generatedAt: new Date().toISOString()
    });
  }

  /**
   * Publish invoice sent event
   */
  async publishInvoiceSent(eventData) {
    await this.publishEvent('invoice.sent', {
      invoiceId: eventData.invoiceId,
      email: eventData.email,
      sentAt: eventData.sentAt || new Date().toISOString()
    });
  }

  /**
   * Publish invoice status updated event
   */
  async publishInvoiceStatusUpdated(eventData) {
    await this.publishEvent('invoice.status_updated', {
      invoiceId: eventData.invoiceId,
      status: eventData.status,
      updatedAt: eventData.updatedAt || new Date().toISOString()
    });
  }

  /**
   * Publish payment method added event
   */
  async publishPaymentMethodAdded(eventData) {
    await this.publishEvent('payment_method.added', {
      patientId: eventData.patientId,
      paymentMethodId: eventData.paymentMethodId,
      type: eventData.type,
      last4: eventData.last4,
      addedAt: new Date().toISOString()
    });
  }

  /**
   * Publish payment method removed event
   */
  async publishPaymentMethodRemoved(eventData) {
    await this.publishEvent('payment_method.removed', {
      patientId: eventData.patientId,
      paymentMethodId: eventData.paymentMethodId,
      removedAt: new Date().toISOString()
    });
  }

  /**
   * Generic event publishing method
   */
  async publishEvent(routingKey, eventData) {
    try {
      if (!this.channel) {
        throw new Error('Event publisher not initialized');
      }

      const message = {
        eventType: routingKey,
        timestamp: new Date().toISOString(),
        source: 'payment-service',
        data: eventData
      };

      await this.channel.publish(
        this.exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      console.log(`Published event: ${routingKey}`, message);
    } catch (error) {
      console.error(`Failed to publish event ${routingKey}:`, error);
      throw error;
    }
  }

  /**
   * Close connection
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('Payment service event publisher closed');
    } catch (error) {
      console.error('Error closing event publisher:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      return this.connection && this.channel;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new EventPublisher();