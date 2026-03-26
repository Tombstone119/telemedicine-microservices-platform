const paymentService = require('./paymentService');
const paymentGateway = require('./paymentGateway');
const eventPublisher = require('./eventPublisher');

class WebhookHandler {
  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Handle Stripe webhook
   */
  async handleStripeWebhook(req, res) {
    try {
      const sig = req.headers['stripe-signature'];
      const rawBody = req.rawBody || JSON.stringify(req.body);

      // Verify webhook signature
      const event = paymentGateway.verifyWebhookSignature(rawBody, sig, this.webhookSecret);

      console.log(`Received Stripe webhook: ${event.type}`);

      // Process the webhook
      const result = await paymentService.processWebhook('stripe', event.type, event);

      if (result.processed) {
        // Publish event based on payment status
        const payment = await paymentService.getPayment(result.payment_id);

        switch (result.status) {
          case 'paid':
            await eventPublisher.publishPaymentCompleted({
              paymentId: result.payment_id,
              appointmentId: payment.appointment_id,
              amount: payment.amount,
              currency: payment.currency,
              paidAt: payment.paid_at
            });
            break;
          case 'failed':
            await eventPublisher.publishPaymentFailed({
              paymentId: result.payment_id,
              appointmentId: payment.appointment_id,
              amount: payment.amount,
              reason: 'Payment failed'
            });
            break;
        }

        res.json({ received: true, processed: true });
      } else {
        res.status(400).json({ received: true, processed: false, reason: result.reason });
      }
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      res.status(400).json({ error: 'Webhook processing failed', message: error.message });
    }
  }

  /**
   * Handle generic webhook (for other payment gateways)
   */
  async handleGenericWebhook(gateway, req, res) {
    try {
      // For generic webhooks, we assume the body contains the event data
      const eventData = req.body;

      console.log(`Received ${gateway} webhook:`, eventData.type || 'unknown');

      // Process the webhook
      const result = await paymentService.processWebhook(gateway, eventData.type, eventData);

      if (result.processed) {
        res.json({ received: true, processed: true });
      } else {
        res.status(400).json({ received: true, processed: false, reason: result.reason });
      }
    } catch (error) {
      console.error(`Error handling ${gateway} webhook:`, error);
      res.status(400).json({ error: 'Webhook processing failed', message: error.message });
    }
  }

  /**
   * Validate webhook origin (additional security)
   */
  validateWebhookOrigin(req, expectedOrigins = []) {
    const origin = req.headers.origin || req.headers.referer;
    if (expectedOrigins.length > 0 && !expectedOrigins.includes(origin)) {
      throw new Error('Invalid webhook origin');
    }
    return true;
  }

  /**
   * Log webhook events for auditing
   */
  async logWebhookEvent(gateway, eventType, eventData, processingResult) {
    try {
      console.log(`Webhook Log - Gateway: ${gateway}, Event: ${eventType}, Processed: ${processingResult.processed}`);

      // In a production system, you might want to store this in a database
      // for compliance and auditing purposes
    } catch (error) {
      console.error('Error logging webhook event:', error);
    }
  }

  /**
   * Handle webhook retry logic
   */
  async handleWebhookRetry(gateway, eventId, retryCount = 0) {
    try {
      const maxRetries = 3;
      const backoffMs = Math.pow(2, retryCount) * 1000; // Exponential backoff

      if (retryCount >= maxRetries) {
        console.error(`Max retries exceeded for webhook ${eventId}`);
        return;
      }

      console.log(`Retrying webhook ${eventId}, attempt ${retryCount + 1}`);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, backoffMs));

      // Retry logic would go here
      // This is a placeholder for implementing retry mechanisms

    } catch (error) {
      console.error('Error in webhook retry:', error);
    }
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats() {
    // This would track webhook processing statistics
    // Implementation would depend on how you store webhook logs
    return {
      totalReceived: 0,
      totalProcessed: 0,
      totalFailed: 0,
      recentEvents: []
    };
  }
}

module.exports = new WebhookHandler();