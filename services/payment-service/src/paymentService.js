const paymentRepository = require('./paymentRepository');
const paymentGateway = require('./paymentGateway');
const axios = require('axios');

class PaymentService {
  constructor() {
    this.appointmentServiceUrl = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3003';
  }

  /**
   * Initiate a payment for an appointment
   */
  async initiatePayment(paymentData) {
    try {
      const appointmentId = paymentData.appointment_id || paymentData.appointmentId;
      const paymentMethod = paymentData.payment_method || paymentData.paymentMethodId || 'stripe';
      const gateway = (paymentData.gateway || 'stripe').toLowerCase();

      if (!appointmentId) {
        throw new Error('appointmentId is required');
      }

      // Validate appointment
      const appointment = await this.validateAppointmentForPayment(appointmentId);

      // Check if payment already exists
      const existingPayment = await paymentRepository.getPaymentByAppointmentId(appointmentId);
      if (existingPayment && existingPayment.status === 'paid') {
        throw new Error('Payment already completed for this appointment');
      }

      // Create payment record
      const paymentRecord = await paymentRepository.createPayment({
        appointment_id: appointmentId,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        amount: appointment.consultation_fee || paymentData.amount,
        currency: (paymentData.currency || 'USD').toUpperCase(),
        payment_method: paymentMethod,
        gateway,
        description: `Consultation payment for appointment ${appointmentId}`,
        metadata: {
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
          doctor_name: appointment.doctor_name,
          patient_name: appointment.patient_name
        }
      });

      // Validate amount against gateway limits
      paymentGateway.validateAmount(paymentRecord.amount);

      // Initiate payment with gateway
      const gatewayResponse = await paymentGateway.initiatePayment(gateway, {
        paymentId: paymentRecord.id,
        appointmentId,
        patientId: appointment.patient_id,
        doctorId: appointment.doctor_id,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        description: paymentRecord.description,
        metadata: paymentRecord.metadata,
        patientEmail: paymentData.patient_email,
        patientName: appointment.patient_name
      });

      // Update payment with gateway transaction ID
      if (gatewayResponse.paymentIntentId || gatewayResponse.sessionId) {
        await paymentRepository.updatePaymentWithGatewayResponse(
          paymentRecord.id,
          gatewayResponse.paymentIntentId || gatewayResponse.sessionId,
          'pending',
          { gateway_response: gatewayResponse }
        );
      }

      // Create payment attempt record
      await paymentRepository.createPaymentAttempt({
        payment_id: paymentRecord.id,
        gateway_transaction_id: gatewayResponse.paymentIntentId || gatewayResponse.sessionId,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        status: 'pending'
      });

      return {
        payment: paymentRecord,
        gateway_response: gatewayResponse
      };
    } catch (error) {
      console.error('Error initiating payment:', error);
      throw error;
    }
  }

  /**
   * Get payment details
   */
  async getPayment(paymentId) {
    try {
      const payment = await paymentRepository.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      const attempts = await paymentRepository.getPaymentAttempts(paymentId);
      const invoice = await paymentRepository.getInvoiceByPaymentId(paymentId);

      return {
        ...payment,
        attempts,
        invoice
      };
    } catch (error) {
      console.error('Error getting payment:', error);
      throw error;
    }
  }

  /**
   * Process payment webhook from gateway
   */
  async processWebhook(gateway, eventType, eventData) {
    try {
      let payment = null;
      let status = 'pending';
      let gatewayTransactionId = null;

      switch (gateway.toLowerCase()) {
        case 'stripe':
          ({ payment, status, gatewayTransactionId } = await this.processStripeWebhook(eventType, eventData));
          break;
        default:
          throw new Error(`Unsupported gateway: ${gateway}`);
      }

      if (payment) {
        // Update payment status
        const paidAt = status === 'paid' ? new Date() : null;
        await paymentRepository.updatePaymentStatus(payment.id, status, gatewayTransactionId, paidAt);

        // Update payment attempt
        await paymentRepository.createPaymentAttempt({
          payment_id: payment.id,
          gateway_transaction_id: gatewayTransactionId,
          amount: payment.amount,
          currency: payment.currency,
          status: status === 'paid' ? 'succeeded' : 'failed',
          gateway_response: eventData
        });

        // Generate invoice if payment is successful
        if (status === 'paid') {
          await this.generateInvoice(payment.id);
        }

        return { payment_id: payment.id, status, processed: true };
      }

      return { processed: false, reason: 'Payment not found or invalid event' };
    } catch (error) {
      console.error('Error processing webhook:', error);
      throw error;
    }
  }

  /**
   * Process Stripe webhook
   */
  async processStripeWebhook(eventType, eventData) {
    let payment = null;
    let status = 'pending';
    let gatewayTransactionId = null;

    switch (eventType) {
      case 'payment_intent.succeeded':
        gatewayTransactionId = eventData.data.object.id;
        payment = await paymentRepository.getPaymentByGatewayTransactionId(gatewayTransactionId);
        if (payment) {
          status = 'paid';
        }
        break;

      case 'payment_intent.payment_failed':
        gatewayTransactionId = eventData.data.object.id;
        payment = await paymentRepository.getPaymentByGatewayTransactionId(gatewayTransactionId);
        if (payment) {
          status = 'failed';
        }
        break;

      case 'checkout.session.completed':
        const session = eventData.data.object;
        payment = await paymentRepository.getPaymentById(session.metadata.payment_id);
        if (payment && session.payment_status === 'paid') {
          status = 'paid';
          gatewayTransactionId = session.payment_intent;
        }
        break;

      default:
        // Unknown event type
        break;
    }

    return { payment, status, gatewayTransactionId };
  }

  /**
   * Verify payment status
   */
  async verifyPayment(paymentId) {
    try {
      const payment = await paymentRepository.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (!payment.gateway_transaction_id) {
        throw new Error('No gateway transaction ID found');
      }

      // Verify with gateway
      const gatewayResponse = await paymentGateway.getPaymentIntent(payment.gateway_transaction_id);

      // Update local status if different
      if (gatewayResponse.status !== payment.status) {
        const newStatus = gatewayResponse.status === 'succeeded' ? 'paid' :
                          gatewayResponse.status === 'failed' ? 'failed' : payment.status;

        if (newStatus !== payment.status) {
          await paymentRepository.updatePaymentStatus(
            paymentId,
            newStatus,
            null,
            newStatus === 'paid' ? new Date() : null
          );

          // Generate invoice if newly paid
          if (newStatus === 'paid' && payment.status !== 'paid') {
            await this.generateInvoice(paymentId);
          }
        }
      }

      return {
        payment_id: paymentId,
        status: gatewayResponse.status,
        verified: true
      };
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  }

  /**
   * Generate invoice for successful payment
   */
  async generateInvoice(paymentId) {
    try {
      const payment = await paymentRepository.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Generate invoice number
      const invoiceNumber = `INV-${paymentId}-${Date.now()}`;

      // Get appointment details for invoice
      const appointment = await this.getAppointmentDetails(payment.appointment_id);

      const invoiceData = {
        payment_id: paymentId,
        invoice_number: invoiceNumber,
        patient_name: appointment.patient_name || 'Patient',
        doctor_name: appointment.doctor_name || 'Doctor',
        appointment_date: appointment.appointment_date,
        consultation_fee: payment.amount,
        tax_amount: 0, // Could be calculated based on business rules
        total_amount: payment.amount,
        invoice_data: {
          payment_date: payment.paid_at,
          payment_method: payment.payment_method,
          gateway: payment.gateway,
          currency: payment.currency
        }
      };

      const invoice = await paymentRepository.createInvoice(invoiceData);

      // In a real implementation, you would generate a PDF here
      // For now, we'll just store the invoice data

      return invoice;
    } catch (error) {
      console.error('Error generating invoice:', error);
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
   * Validate appointment for payment
   */
  async validateAppointmentForPayment(appointmentId) {
    try {
      const appointment = await this.getAppointmentDetails(appointmentId);

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      if (appointment.status !== 'accepted' && appointment.status !== 'completed') {
        throw new Error('Appointment must be accepted before payment can be initiated');
      }

      if (!appointment.consultation_fee || appointment.consultation_fee <= 0) {
        throw new Error('Invalid consultation fee');
      }

      return appointment;
    } catch (error) {
      console.error('Error validating appointment:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(dateFrom = null, dateTo = null) {
    try {
      return await paymentRepository.getPaymentStatistics(dateFrom, dateTo);
    } catch (error) {
      console.error('Error getting payment statistics:', error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  async processRefund(paymentId, amount = null, reason = 'requested_by_customer') {
    try {
      const payment = await paymentRepository.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'paid') {
        throw new Error('Only paid payments can be refunded');
      }

      const refund = await paymentGateway.createRefund(
        payment.gateway_transaction_id,
        amount,
        reason
      );

      // Update payment status
      await paymentRepository.updatePaymentStatus(paymentId, 'refunded');

      return {
        refund_id: refund.refundId,
        amount: refund.amount,
        status: refund.status
      };
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();