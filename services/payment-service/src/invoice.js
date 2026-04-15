const paymentRepository = require('./paymentRepository');
const eventPublisher = require('./eventPublisher');
const axios = require('axios');

class InvoiceService {
  constructor() {
    this.appointmentServiceUrl = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3003';
  }

  /**
   * Generate invoice for a payment
   */
  async generateInvoice(paymentId) {
    try {
      const payment = await paymentRepository.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Avoid duplicate invoices for the same payment
      const existing = await paymentRepository.getInvoiceByPaymentId(paymentId);
      if (existing) {
        return existing;
      }

      // Get appointment details for invoice
      const appointment = await this.getAppointmentDetails(payment.appointment_id);

      const taxAmount = this.calculateTax(payment.amount);
      const totalAmount = Number(payment.amount) + Number(taxAmount);

      const invoiceData = {
        payment_id: payment.id,
        invoice_number: this.generateInvoiceNumber(payment.id),
        patient_name: appointment.patient_name || `Patient #${payment.patient_id}`,
        doctor_name: appointment.doctor_name || `Doctor #${payment.doctor_id}`,
        appointment_date: appointment.appointment_date || new Date().toISOString().slice(0, 10),
        consultation_fee: payment.amount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        invoice_data: {
          appointment_id: payment.appointment_id,
          patient_id: payment.patient_id,
          doctor_id: payment.doctor_id,
          payment_method: payment.payment_method,
          currency: payment.currency,
          issued_at: new Date().toISOString()
        }
      };

      // Save invoice to database
      const savedInvoice = await paymentRepository.createInvoice(invoiceData);

      // Publish invoice generated event
      await eventPublisher.publishInvoiceGenerated({
        invoiceId: savedInvoice.id,
        paymentId: paymentId,
        appointmentId: payment.appointment_id,
        amount: savedInvoice.total_amount,
        patientId: appointment.patient_id,
        doctorId: appointment.doctor_id
      });

      return savedInvoice;
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId) {
    try {
      return await paymentRepository.getInvoiceById(invoiceId);
    } catch (error) {
      console.error('Error getting invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoices for a patient
   */
  async getPatientInvoices(patientId, page = 1, limit = 10) {
    try {
      return await paymentRepository.getInvoicesByPatientId(patientId, page, limit);
    } catch (error) {
      console.error('Error getting patient invoices:', error);
      throw error;
    }
  }

  /**
   * Get invoices for a doctor
   */
  async getDoctorInvoices(doctorId, page = 1, limit = 10) {
    try {
      return await paymentRepository.getInvoicesByDoctorId(doctorId, page, limit);
    } catch (error) {
      console.error('Error getting doctor invoices:', error);
      throw error;
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(invoiceId, status) {
    // Schema does not store invoice status separately; keep for compatibility.
    return { id: invoiceId, status };
  }

  /**
   * Generate PDF invoice (placeholder - would integrate with PDF library)
   */
  async generatePDF(invoiceId) {
    try {
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // In a real implementation, you would use a library like pdfkit or puppeteer
      // to generate a PDF from the invoice data
      const pdfContent = this.formatInvoiceAsText(invoice);

      // For now, return a placeholder
      return {
        filename: `invoice-${invoice.invoice_number}.pdf`,
        content: pdfContent,
        contentType: 'application/pdf'
      };
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Send invoice via email (placeholder)
   */
  async sendInvoiceEmail(invoiceId, email) {
    try {
      const invoice = await this.getInvoice(invoiceId);

      // In a real implementation, you would integrate with an email service
      // like SendGrid, Mailgun, or AWS SES
      console.log(`Sending invoice ${invoice.invoice_number} to ${email}`);

      // Publish email sent event
      await eventPublisher.publishInvoiceSent({
        invoiceId: invoiceId,
        email: email,
        sentAt: new Date().toISOString()
      });

      return { sent: true, email: email };
    } catch (error) {
      console.error('Error sending invoice email:', error);
      throw error;
    }
  }

  /**
   * Calculate tax amount (placeholder - implement based on your tax rules)
   */
  calculateTax(amount) {
    const rate = Number(process.env.TAX_RATE || 0);
    return Math.round(Number(amount) * rate * 100) / 100;
  }

  /**
   * Generate unique invoice number
   */
  generateInvoiceNumber(paymentId) {
    return `INV-${paymentId}-${Date.now()}`;
  }

  /**
   * Get appointment details (placeholder - would call appointment service)
   */
  async getAppointmentDetails(appointmentId) {
    try {
      const response = await axios.get(`${this.appointmentServiceUrl}/api/appointments/${appointmentId}`);
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch appointment details for invoice:', error.message);
      return {};
    }
  }

  /**
   * Format invoice as text (for PDF placeholder)
   */
  formatInvoiceAsText(invoice) {
    return `
TELEMEDICINE PLATFORM INVOICE
============================

Invoice ID: ${invoice.invoice_id}
Payment ID: ${invoice.payment_id}
Date: ${new Date(invoice.generated_at || invoice.created_at).toLocaleDateString()}

Patient: ${invoice.patient_name}
Doctor: ${invoice.doctor_name}

Consultation Fee: $${invoice.consultation_fee}
Tax: $${invoice.tax_amount}
Total: $${invoice.total_amount}

Payment Method: ${invoice.payment_method || 'N/A'}
Payment Status: ${invoice.payment_status || 'N/A'}

Thank you for using our telemedicine platform!
    `.trim();
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats() {
    try {
      const stats = await paymentRepository.getInvoiceStats();
      return {
        totalInvoices: Number(stats.total_count || 0),
        totalRevenue: Number(stats.total_revenue || 0)
      };
    } catch (error) {
      console.error('Error getting invoice stats:', error);
      throw error;
    }
  }
}

module.exports = new InvoiceService();