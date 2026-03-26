const pool = require('./db');

const paymentRepository = {
  /**
   * Create a new payment record
   */
  async createPayment(paymentData) {
    const {
      appointment_id, patient_id, doctor_id, amount, currency = 'USD',
      payment_method, gateway = 'stripe', description, metadata
    } = paymentData;

    const query = `
      INSERT INTO payments (
        appointment_id, patient_id, doctor_id, amount, currency,
        payment_method, gateway, description, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const values = [
      appointment_id, patient_id, doctor_id, amount, currency,
      payment_method, gateway, description, JSON.stringify(metadata || {})
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId) {
    const query = `
      SELECT * FROM payments WHERE id = $1;
    `;
    const result = await pool.query(query, [paymentId]);
    return result.rows[0];
  },

  /**
   * Get payment by appointment ID
   */
  async getPaymentByAppointmentId(appointmentId) {
    const query = `
      SELECT * FROM payments WHERE appointment_id = $1;
    `;
    const result = await pool.query(query, [appointmentId]);
    return result.rows[0];
  },

  /**
   * Get payment by gateway transaction ID
   */
  async getPaymentByGatewayTransactionId(gatewayTransactionId) {
    const query = `
      SELECT * FROM payments WHERE gateway_transaction_id = $1;
    `;
    const result = await pool.query(query, [gatewayTransactionId]);
    return result.rows[0];
  },

  /**
   * Get payments by patient ID
   */
  async getPaymentsByPatient(patientId, limit = 50) {
    const query = `
      SELECT * FROM payments
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [patientId, limit]);
    return result.rows;
  },

  /**
   * Get payments by doctor ID
   */
  async getPaymentsByDoctor(doctorId, limit = 50) {
    const query = `
      SELECT * FROM payments
      WHERE doctor_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [doctorId, limit]);
    return result.rows;
  },

  /**
   * Update payment status
   */
  async updatePaymentStatus(paymentId, status, gatewayTransactionId = null, paidAt = null) {
    const updates = ['status = $1'];
    const values = [status];
    let paramCounter = 2;

    if (gatewayTransactionId) {
      updates.push(`gateway_transaction_id = $${paramCounter}`);
      values.push(gatewayTransactionId);
      paramCounter++;
    }

    if (paidAt) {
      updates.push(`paid_at = $${paramCounter}`);
      values.push(paidAt);
      paramCounter++;
    }

    updates.push(`updated_at = NOW()`);
    values.push(paymentId);

    const query = `
      UPDATE payments
      SET ${updates.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *;
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Update payment with gateway response
   */
  async updatePaymentWithGatewayResponse(paymentId, gatewayTransactionId, status, metadata = {}) {
    const query = `
      UPDATE payments
      SET status = $1, gateway_transaction_id = $2, metadata = metadata || $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *;
    `;

    const result = await pool.query(query, [status, gatewayTransactionId, JSON.stringify(metadata), paymentId]);
    return result.rows[0];
  },

  /**
   * Create payment attempt record
   */
  async createPaymentAttempt(attemptData) {
    const {
      payment_id, gateway_transaction_id, amount, currency = 'USD',
      status, gateway_response, error_message
    } = attemptData;

    const query = `
      INSERT INTO payment_attempts (
        payment_id, gateway_transaction_id, amount, currency,
        status, gateway_response, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [
      payment_id, gateway_transaction_id, amount, currency,
      status, JSON.stringify(gateway_response || {}), error_message
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Get payment attempts for a payment
   */
  async getPaymentAttempts(paymentId) {
    const query = `
      SELECT * FROM payment_attempts
      WHERE payment_id = $1
      ORDER BY attempted_at DESC;
    `;
    const result = await pool.query(query, [paymentId]);
    return result.rows;
  },

  /**
   * Create invoice record
   */
  async createInvoice(invoiceData) {
    const {
      payment_id, invoice_number, patient_name, doctor_name,
      appointment_date, consultation_fee, tax_amount = 0, total_amount, invoice_data
    } = invoiceData;

    const query = `
      INSERT INTO invoices (
        payment_id, invoice_number, patient_name, doctor_name,
        appointment_date, consultation_fee, tax_amount, total_amount, invoice_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const values = [
      payment_id, invoice_number, patient_name, doctor_name,
      appointment_date, consultation_fee, tax_amount, total_amount, JSON.stringify(invoice_data || {})
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId) {
    const query = `
      SELECT * FROM invoices WHERE id = $1;
    `;
    const result = await pool.query(query, [invoiceId]);
    return result.rows[0];
  },

  /**
   * Get invoice by payment ID
   */
  async getInvoiceByPaymentId(paymentId) {
    const query = `
      SELECT * FROM invoices WHERE payment_id = $1;
    `;
    const result = await pool.query(query, [paymentId]);
    return result.rows[0];
  },

  /**
   * Update invoice with PDF URL
   */
  async updateInvoicePdfUrl(invoiceId, pdfUrl) {
    const query = `
      UPDATE invoices
      SET pdf_url = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    const result = await pool.query(query, [pdfUrl, invoiceId]);
    return result.rows[0];
  },

  /**
   * Get payments by status
   */
  async getPaymentsByStatus(status, limit = 100) {
    const query = `
      SELECT * FROM payments
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [status, limit]);
    return result.rows;
  },

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(dateFrom = null, dateTo = null) {
    let query = `
      SELECT
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_payments,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
        AVG(CASE WHEN status = 'paid' THEN amount ELSE NULL END) as average_payment
      FROM payments
    `;

    const values = [];
    let paramCounter = 1;

    if (dateFrom || dateTo) {
      query += ' WHERE ';
      if (dateFrom) {
        query += `created_at >= $${paramCounter}`;
        values.push(dateFrom);
        paramCounter++;
      }
      if (dateTo) {
        if (dateFrom) query += ' AND ';
        query += `created_at <= $${paramCounter}`;
        values.push(dateTo);
        paramCounter++;
      }
    }

    const result = await pool.query(query, values);
    return result.rows[0];
  }
};

module.exports = paymentRepository;