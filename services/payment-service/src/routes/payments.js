const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');
const { stripe } = require('../stripe');

const router = express.Router();

function resolveFrontendBaseUrl(frontendBaseUrlRaw) {
  const candidate = typeof frontendBaseUrlRaw === 'string' ? frontendBaseUrlRaw.trim() : '';
  if (!candidate) {
    return (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  }

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch (_error) {
    return (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  }
}

router.post('/create-intent', verifyToken, requireRole('patient'), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const appointmentId = parseInt(req.body.appointment_id, 10);
    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'appointment_id is required' });
    }

    const appointmentResult = await pool.query(
      `
        SELECT a.id, a.patient_id, a.doctor_id, a.status, a.payment_status, d.consultation_fee
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        WHERE a.id = $1
        LIMIT 1
      `,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (appointment.payment_status === 'paid') {
      return res.status(409).json({ error: 'Appointment is already paid' });
    }

    if (!appointment.consultation_fee) {
      return res.status(400).json({ error: 'Doctor consultation fee is not configured' });
    }

    const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
    const amount = Math.round(Number(appointment.consultation_fee) * 100);

    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        appointment_id: String(appointment.id),
        patient_id: String(appointment.patient_id),
        doctor_id: String(appointment.doctor_id),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return res.status(201).json({
      appointment_id: appointment.id,
      payment_intent_id: intent.id,
      client_secret: intent.client_secret,
      amount,
      currency,
      payment_status: appointment.payment_status,
    });
  } catch (error) {
    console.error('[PaymentService] POST /create-intent error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/create-checkout-session', verifyToken, requireRole('patient'), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const appointmentId = parseInt(req.body.appointment_id, 10);
    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'appointment_id is required' });
    }

    const appointmentResult = await pool.query(
      `
        SELECT a.id, a.patient_id, a.doctor_id, a.status, a.payment_status, a.appointment_time,
               d.consultation_fee, u.full_name AS doctor_name, d.specialty
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        JOIN users u ON u.id = d.user_id
        WHERE a.id = $1
        LIMIT 1
      `,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (appointment.payment_status === 'paid') {
      return res.status(409).json({ error: 'Appointment is already paid' });
    }

    if (!appointment.consultation_fee) {
      return res.status(400).json({ error: 'Doctor consultation fee is not configured' });
    }

    const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
    const amount = Math.round(Number(appointment.consultation_fee) * 100);
    const frontendBaseUrl = resolveFrontendBaseUrl(req.body.frontend_base_url || req.headers.origin);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Telemedicine appointment with ${appointment.doctor_name}`,
              description: appointment.specialty || 'Doctor consultation',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        appointment_id: String(appointment.id),
        patient_id: String(appointment.patient_id),
        doctor_id: String(appointment.doctor_id),
      },
      success_url: `${frontendBaseUrl}/patient/appointments?payment=success&session_id={CHECKOUT_SESSION_ID}&appointment_id=${appointment.id}`,
      cancel_url: `${frontendBaseUrl}/patient/search?payment=cancelled&appointment_id=${appointment.id}`,
    });

    return res.status(201).json({
      appointment_id: appointment.id,
      checkout_session_id: session.id,
      checkout_url: session.url,
      amount,
      currency,
    });
  } catch (error) {
    console.error('[PaymentService] POST /create-checkout-session error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
