const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

class PaymentGatewayService {
  constructor() {
    this.stripe = stripe;
    this.currency = 'usd'; // Default currency
    this.successUrl = process.env.PAYMENT_SUCCESS_URL || 'http://localhost:3000/payment/success';
    this.cancelUrl = process.env.PAYMENT_CANCEL_URL || 'http://localhost:3000/payment/cancel';
  }

  /**
   * Create a payment intent with Stripe
   */
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata: {
          ...metadata,
          service: 'telemedicine-payment'
        },
        description: metadata.description || 'Telemedicine consultation payment',
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  /**
   * Create a checkout session for redirect-based payments
   */
  async createCheckoutSession(paymentData, successUrl, cancelUrl) {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: paymentData.currency || 'usd',
              product_data: {
                name: paymentData.description || 'Telemedicine Consultation',
                description: `Appointment ID: ${paymentData.appointmentId}`,
              },
              unit_amount: Math.round(paymentData.amount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&payment_id=${paymentData.paymentId}`,
        cancel_url: cancelUrl,
        metadata: {
          payment_id: paymentData.paymentId,
          appointment_id: paymentData.appointmentId,
          patient_id: paymentData.patientId,
          doctor_id: paymentData.doctorId
        },
        customer_email: paymentData.patientEmail,
      });

      return {
        sessionId: session.id,
        url: session.url,
        paymentIntentId: session.payment_intent
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Create a PayHere payment URL (sandbox)
   */
  async createPayHerePayment(paymentData) {
    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const returnUrl = process.env.PAYHERE_RETURN_URL || this.successUrl;
    const cancelUrl = process.env.PAYHERE_CANCEL_URL || this.cancelUrl;

    if (!merchantId) {
      throw new Error('PAYHERE_MERCHANT_ID is not configured');
    }

    const paymentReference = this.generatePaymentReference(paymentData.paymentId);
    const data = {
      merchant_id: merchantId,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: process.env.PAYHERE_NOTIFY_URL || `${process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005'}/api/payments/webhook/payhere`,
      order_id: paymentReference,
      items: paymentData.description || 'Telemedicine consultation',
      currency: paymentData.currency || 'USD',
      amount: paymentData.amount,
      first_name: paymentData.patientName || 'Patient',
      last_name: paymentData.patientName ? paymentData.patientName.split(' ').slice(-1).join(' ') : 'Customer',
      email: paymentData.patientEmail || 'patient@example.com'
    };

    const queryParams = new URLSearchParams();
    Object.keys(data).forEach(key => queryParams.append(key, data[key]));

    const url = `https://sandbox.payhere.lk/pay/checkout?${queryParams.toString()}`;

    return {
      gateway: 'payhere',
      paymentReference,
      paymentUrl: url,
      amount: paymentData.amount,
      currency: paymentData.currency || 'USD',
      status: 'pending'
    };
  }

  /**
   * Create a Dialog Genie payment link (mocked sandbox)
   */
  async createDialogGeniePayment(paymentData) {
    const apiKey = process.env.DIALOG_GENIE_API_KEY;
    if (!apiKey) {
      throw new Error('DIALOG_GENIE_API_KEY is not configured');
    }

    const paymentReference = this.generatePaymentReference(paymentData.paymentId);
    const link = `${process.env.DIALOG_GENIE_URL || 'https://sandbox.dialog.lk/genie/pay'}?ref=${encodeURIComponent(paymentReference)}&amount=${encodeURIComponent(paymentData.amount)}&currency=${encodeURIComponent(paymentData.currency || 'USD')}`;

    return {
      gateway: 'dialog_genie',
      paymentReference,
      paymentUrl: link,
      amount: paymentData.amount,
      currency: paymentData.currency || 'USD',
      status: 'pending'
    };
  }

  /**
   * Create a FriMi payment link (mocked sandbox)
   */
  async createFriMiPayment(paymentData) {
    const apiKey = process.env.FRIMI_API_KEY;
    if (!apiKey) {
      throw new Error('FRIMI_API_KEY is not configured');
    }

    const paymentReference = this.generatePaymentReference(paymentData.paymentId);
    const link = `${process.env.FRIMI_URL || 'https://sandbox.frimi.lk/invoice'}?ref=${encodeURIComponent(paymentReference)}&amount=${encodeURIComponent(paymentData.amount)}&currency=${encodeURIComponent(paymentData.currency || 'USD')}`;

    return {
      gateway: 'frimi',
      paymentReference,
      paymentUrl: link,
      amount: paymentData.amount,
      currency: paymentData.currency || 'USD',
      status: 'pending'
    };
  }

  /**
   * Retrieve payment intent status
   */
  async getPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
        charges: paymentIntent.charges
      };
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      throw new Error('Failed to retrieve payment intent');
    }
  }

  /**
   * Retrieve checkout session
   */
  async getCheckoutSession(sessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return {
        id: session.id,
        paymentStatus: session.payment_status,
        paymentIntentId: session.payment_intent,
        metadata: session.metadata,
        customerEmail: session.customer_details?.email
      };
    } catch (error) {
      console.error('Error retrieving checkout session:', error);
      throw new Error('Failed to retrieve checkout session');
    }
  }

  /**
   * Process refund
   */
  async createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason
      });

      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100,
        currency: refund.currency
      };
    } catch (error) {
      console.error('Error creating refund:', error);
      throw new Error('Failed to create refund');
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature, webhookSecret) {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Handle different payment gateway types
   */
  async initiatePayment(gateway, paymentData) {
    switch (gateway.toLowerCase()) {
      case 'stripe':
        return await this.createPaymentIntent(
          paymentData.amount,
          paymentData.currency,
          paymentData.metadata
        );
      case 'stripe_checkout':
        return await this.createCheckoutSession(
          paymentData,
          this.successUrl,
          this.cancelUrl
        );
      case 'payhere':
        return await this.createPayHerePayment(paymentData);
      case 'dialog_genie':
      case 'dialog':
        return await this.createDialogGeniePayment(paymentData);
      case 'frimi':
        return await this.createFriMiPayment(paymentData);
      case 'paypal':
        return {
          gateway: 'paypal',
          paymentReference: this.generatePaymentReference(paymentData.paymentId),
          paymentUrl: `${process.env.PAYPAL_SANDBOX_URL || 'https://www.sandbox.paypal.com/checkoutnow'}?amount=${encodeURIComponent(paymentData.amount)}&currency=${encodeURIComponent(paymentData.currency || 'USD')}`,
          amount: paymentData.amount,
          currency: paymentData.currency || 'USD',
          status: 'pending'
        };
      default:
        throw new Error(`Unsupported payment gateway: ${gateway}`);
    }
  }

  /**
   * Generate secure payment reference
   */
  generatePaymentReference(paymentId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `PAY-${paymentId}-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Validate payment amount
   */
  validateAmount(amount) {
    if (!amount || amount <= 0 || amount > 10000) {
      throw new Error('Invalid payment amount');
    }
    return true;
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies() {
    return ['usd', 'eur', 'gbp', 'aud', 'cad'];
  }

  /**
   * Format amount for display
   */
  formatAmount(amount, currency = 'usd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  }
}

module.exports = new PaymentGatewayService();