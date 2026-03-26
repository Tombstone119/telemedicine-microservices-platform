const paymentRepository = require('./paymentRepository');
const eventPublisher = require('./eventPublisher');

class InvoiceService {
  constructor() {
    this.invoiceCounter = 0; // In production, this would be managed by the database
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

      // Get appointment details for invoice
      const appointment = await this.getAppointmentDetails(payment.appointment_id);

      const invoice = {
        invoiceId: this.generateInvoiceId(),
        paymentId: payment.id,
        appointmentId: payment.appointment_id,
        patientId: appointment.patient_id,
        doctorId: appointment.doctor_id,
        amount: payment.amount,
        currency: payment.currency,
        taxAmount: this.calculateTax(payment.amount),
        totalAmount: payment.amount + this.calculateTax(payment.amount),
        status: payment.status,
        issuedAt: new Date().toISOString(),
        dueDate: this.calculateDueDate(),
        items: [
          {
            description: `Consultation with Dr. ${appointment.doctor_name}`,
            quantity: 1,
            unitPrice: payment.amount,
            total: payment.amount
          }
        ],
        patientDetails: {
          name: appointment.patient_name,
          email: appointment.patient_email,
          phone: appointment.patient_phone
        },
        doctorDetails: {
          name: appointment.doctor_name,
          specialization: appointment.doctor_specialization,
          licenseNumber: appointment.doctor_license
        },
        paymentMethod: payment.payment_method,
        transactionId: payment.transaction_id
      };

      // Save invoice to database
      const savedInvoice = await paymentRepository.createInvoice(invoice);

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
    try {
      const updatedInvoice = await paymentRepository.updateInvoiceStatus(invoiceId, status);

      // Publish invoice status updated event
      await eventPublisher.publishInvoiceStatusUpdated({
        invoiceId: invoiceId,
        status: status,
        updatedAt: new Date().toISOString()
      });

      return updatedInvoice;
    } catch (error) {
      console.error('Error updating invoice status:', error);
      throw error;
    }
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
        filename: `invoice-${invoice.invoice_id}.pdf`,
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
      console.log(`Sending invoice ${invoice.invoice_id} to ${email}`);

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
    // Example: 10% tax
    return Math.round(amount * 0.1 * 100) / 100;
  }

  /**
   * Calculate due date (30 days from now)
   */
  calculateDueDate() {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate.toISOString();
  }

  /**
   * Generate unique invoice ID
   */
  generateInvoiceId() {
    const timestamp = Date.now();
    const counter = ++this.invoiceCounter;
    return `INV-${timestamp}-${counter.toString().padStart(4, '0')}`;
  }

  /**
   * Get appointment details (placeholder - would call appointment service)
   */
  async getAppointmentDetails(appointmentId) {
    // In a real implementation, this would make an HTTP call to the appointment service
    // For now, return mock data
    return {
      id: appointmentId,
      patient_id: 'patient-123',
      doctor_id: 'doctor-456',
      patient_name: 'John Doe',
      patient_email: 'john.doe@example.com',
      patient_phone: '+1234567890',
      doctor_name: 'Dr. Jane Smith',
      doctor_specialization: 'Cardiology',
      doctor_license: 'MD12345',
      scheduled_at: new Date().toISOString()
    };
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
Date: ${new Date(invoice.issued_at).toLocaleDateString()}
Due Date: ${new Date(invoice.due_date).toLocaleDateString()}

Patient Details:
Name: ${invoice.patient_details.name}
Email: ${invoice.patient_details.email}
Phone: ${invoice.patient_details.phone}

Doctor Details:
Name: ${invoice.doctor_details.name}
Specialization: ${invoice.doctor_details.specialization}
License: ${invoice.doctor_details.license}

Items:
${invoice.items.map(item =>
  `${item.description} - Quantity: ${item.quantity} - Unit Price: $${item.unit_price} - Total: $${item.total}`
).join('\n')}

Subtotal: $${invoice.amount}
Tax: $${invoice.tax_amount}
Total: $${invoice.total_amount}

Payment Method: ${invoice.payment_method}
Transaction ID: ${invoice.transaction_id}
Status: ${invoice.status}

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
        totalInvoices: stats.total_count || 0,
        totalRevenue: stats.total_revenue || 0,
        paidInvoices: stats.paid_count || 0,
        pendingInvoices: stats.pending_count || 0,
        overdueInvoices: stats.overdue_count || 0
      };
    } catch (error) {
      console.error('Error getting invoice stats:', error);
      throw error;
    }
  }
}

module.exports = new InvoiceService();