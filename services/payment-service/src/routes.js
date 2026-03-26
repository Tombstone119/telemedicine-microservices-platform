const express = require('express');
const router = express.Router();
const paymentService = require('./paymentService');
const webhookHandler = require('./webhookHandler');
const invoiceService = require('./invoice');
const auth = require('../../shared/middleware/auth');

// Middleware to parse raw body for webhooks
const rawBodyParser = (req, res, next) => {
  if (req.headers['content-type'] === 'application/json') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        req.rawBody = data;
        req.body = JSON.parse(data);
        next();
      } catch (error) {
        res.status(400).json({ error: 'Invalid JSON' });
      }
    });
  } else {
    next();
  }
};

// Payment routes

/**
 * @route POST /payments/initiate
 * @desc Initiate a payment for an appointment
 * @access Private (Patient)
 */
router.post('/initiate', auth.authenticate, auth.authorize(['patient']), async (req, res) => {
  try {
    const { appointmentId, paymentMethodId, amount, currency = 'usd' } = req.body;

    if (!appointmentId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['appointmentId', 'amount']
      });
    }

    const paymentData = {
      appointmentId,
      patientId: req.user.id,
      paymentMethodId,
      amount: parseFloat(amount),
      currency: currency.toLowerCase()
    };

    const result = await paymentService.initiatePayment(paymentData);

    res.status(201).json({
      success: true,
      payment: result.payment,
      clientSecret: result.clientSecret
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({
      error: 'Failed to initiate payment',
      message: error.message
    });
  }
});

/**
 * @route GET /payments/:id
 * @desc Get payment details
 * @access Private (Patient/Doctor/Admin)
 */
router.get('/:id', auth.authenticate, async (req, res) => {
  try {
    const paymentId = req.params.id;
    const payment = await paymentService.getPayment(paymentId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check if user has access to this payment
    if (req.user.role === 'patient' && payment.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'doctor') {
      // Check if doctor is associated with the appointment
      const appointment = await paymentService.getAppointmentForPayment(paymentId);
      if (appointment.doctor_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({ payment });
  } catch (error) {
    console.error('Error getting payment:', error);
    res.status(500).json({
      error: 'Failed to get payment',
      message: error.message
    });
  }
});

/**
 * @route GET /payments
 * @desc Get payments for current user
 * @access Private (Patient/Doctor)
 */
router.get('/', auth.authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    let payments;

    if (req.user.role === 'patient') {
      payments = await paymentService.getPatientPayments(req.user.id, parseInt(page), parseInt(limit), status);
    } else if (req.user.role === 'doctor') {
      payments = await paymentService.getDoctorPayments(req.user.id, parseInt(page), parseInt(limit), status);
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ payments });
  } catch (error) {
    console.error('Error getting payments:', error);
    res.status(500).json({
      error: 'Failed to get payments',
      message: error.message
    });
  }
});

/**
 * @route POST /payments/:id/refund
 * @desc Refund a payment
 * @access Private (Admin/Doctor)
 */
router.post('/:id/refund', auth.authenticate, auth.authorize(['admin', 'doctor']), async (req, res) => {
  try {
    const paymentId = req.params.id;
    const { amount, reason } = req.body;

    const result = await paymentService.refundPayment(paymentId, amount, reason);

    res.json({
      success: true,
      refund: result.refund
    });
  } catch (error) {
    console.error('Error refunding payment:', error);
    res.status(500).json({
      error: 'Failed to refund payment',
      message: error.message
    });
  }
});

/**
 * @route POST /payments/webhook/stripe
 * @desc Handle Stripe webhooks
 * @access Public (Stripe)
 */
router.post('/webhook/stripe', rawBodyParser, webhookHandler.handleStripeWebhook.bind(webhookHandler));

/**
 * @route POST /payments/webhook/:gateway
 * @desc Handle generic payment gateway webhooks
 * @access Public (Payment Gateway)
 */
router.post('/webhook/:gateway', rawBodyParser, async (req, res) => {
  try {
    const gateway = req.params.gateway;
    await webhookHandler.handleGenericWebhook(gateway, req, res);
  } catch (error) {
    console.error(`Error handling ${req.params.gateway} webhook:`, error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
});

// Invoice routes

/**
 * @route POST /invoices/generate/:paymentId
 * @desc Generate invoice for a payment
 * @access Private (Patient/Doctor/Admin)
 */
router.post('/invoices/generate/:paymentId', auth.authenticate, async (req, res) => {
  try {
    const paymentId = req.params.paymentId;

    // Check if user has access to this payment
    const payment = await paymentService.getPayment(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (req.user.role === 'patient' && payment.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const invoice = await invoiceService.generateInvoice(paymentId);

    res.status(201).json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      error: 'Failed to generate invoice',
      message: error.message
    });
  }
});

/**
 * @route GET /invoices/:id
 * @desc Get invoice details
 * @access Private (Patient/Doctor/Admin)
 */
router.get('/invoices/:id', auth.authenticate, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await invoiceService.getInvoice(invoiceId);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check access permissions
    if (req.user.role === 'patient' && invoice.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'doctor' && invoice.doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Error getting invoice:', error);
    res.status(500).json({
      error: 'Failed to get invoice',
      message: error.message
    });
  }
});

/**
 * @route GET /invoices
 * @desc Get invoices for current user
 * @access Private (Patient/Doctor)
 */
router.get('/invoices', auth.authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    let invoices;

    if (req.user.role === 'patient') {
      invoices = await invoiceService.getPatientInvoices(req.user.id, parseInt(page), parseInt(limit));
    } else if (req.user.role === 'doctor') {
      invoices = await invoiceService.getDoctorInvoices(req.user.id, parseInt(page), parseInt(limit));
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ invoices });
  } catch (error) {
    console.error('Error getting invoices:', error);
    res.status(500).json({
      error: 'Failed to get invoices',
      message: error.message
    });
  }
});

/**
 * @route GET /invoices/:id/pdf
 * @desc Download invoice PDF
 * @access Private (Patient/Doctor/Admin)
 */
router.get('/invoices/:id/pdf', auth.authenticate, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await invoiceService.getInvoice(invoiceId);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check access permissions
    if (req.user.role === 'patient' && invoice.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'doctor' && invoice.doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pdf = await invoiceService.generatePDF(invoiceId);

    res.setHeader('Content-Type', pdf.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
    res.send(pdf.content);
  } catch (error) {
    console.error('Error downloading invoice PDF:', error);
    res.status(500).json({
      error: 'Failed to download invoice PDF',
      message: error.message
    });
  }
});

/**
 * @route POST /invoices/:id/send
 * @desc Send invoice via email
 * @access Private (Patient/Doctor/Admin)
 */
router.post('/invoices/:id/send', auth.authenticate, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const invoice = await invoiceService.getInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check access permissions
    if (req.user.role === 'patient' && invoice.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'doctor' && invoice.doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await invoiceService.sendInvoiceEmail(invoiceId, email);

    res.json({
      success: true,
      message: 'Invoice sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).json({
      error: 'Failed to send invoice',
      message: error.message
    });
  }
});

// Payment method routes

/**
 * @route POST /payment-methods
 * @desc Add a payment method
 * @access Private (Patient)
 */
router.post('/payment-methods', auth.authenticate, auth.authorize(['patient']), async (req, res) => {
  try {
    const { paymentMethodId, type, last4 } = req.body;

    if (!paymentMethodId || !type) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['paymentMethodId', 'type']
      });
    }

    const paymentMethod = await paymentService.addPaymentMethod(req.user.id, {
      paymentMethodId,
      type,
      last4
    });

    res.status(201).json({
      success: true,
      paymentMethod
    });
  } catch (error) {
    console.error('Error adding payment method:', error);
    res.status(500).json({
      error: 'Failed to add payment method',
      message: error.message
    });
  }
});

/**
 * @route GET /payment-methods
 * @desc Get payment methods for current user
 * @access Private (Patient)
 */
router.get('/payment-methods', auth.authenticate, auth.authorize(['patient']), async (req, res) => {
  try {
    const paymentMethods = await paymentService.getPatientPaymentMethods(req.user.id);

    res.json({ paymentMethods });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({
      error: 'Failed to get payment methods',
      message: error.message
    });
  }
});

/**
 * @route DELETE /payment-methods/:id
 * @desc Remove a payment method
 * @access Private (Patient)
 */
router.delete('/payment-methods/:id', auth.authenticate, auth.authorize(['patient']), async (req, res) => {
  try {
    const paymentMethodId = req.params.id;

    await paymentService.removePaymentMethod(req.user.id, paymentMethodId);

    res.json({
      success: true,
      message: 'Payment method removed successfully'
    });
  } catch (error) {
    console.error('Error removing payment method:', error);
    res.status(500).json({
      error: 'Failed to remove payment method',
      message: error.message
    });
  }
});

module.exports = router;