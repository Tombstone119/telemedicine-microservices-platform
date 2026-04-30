const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');
const { stripe } = require('../stripe');

const router = express.Router();

router.get('/admin/income', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const summaryResult = await pool.query(
      `
        SELECT
          COUNT(*)::int AS payment_count,
          COALESCE(SUM(COALESCE(d.consultation_fee, 0)), 0)::numeric AS total_income,
          COALESCE(AVG(COALESCE(d.consultation_fee, 0)), 0)::numeric AS average_payment
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        WHERE a.payment_status = 'paid'
      `
    );

    const itemsResult = await pool.query(
      `
        SELECT
          a.id AS appointment_id,
          a.appointment_time,
          a.paid_at,
          a.payment_status,
          d.consultation_fee AS amount,
          d.specialty,
          u_doctor.full_name AS doctor_name,
          COALESCE(p.name, u_patient.full_name, CONCAT('Patient #', a.patient_id::text)) AS patient_name
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        JOIN users u_doctor ON u_doctor.id = d.user_id
        LEFT JOIN patients p ON p.user_id = a.patient_id
        LEFT JOIN users u_patient ON u_patient.id = a.patient_id
        WHERE a.payment_status = 'paid'
        ORDER BY COALESCE(a.paid_at, a.created_at) DESC NULLS LAST, a.appointment_time DESC
      `
    );

    const summary = summaryResult.rows[0] || { payment_count: 0, total_income: 0, average_payment: 0 };
    const items = itemsResult.rows.map((row) => ({
      appointment_id: row.appointment_id,
      appointment_time: row.appointment_time,
      paid_at: row.paid_at,
      payment_status: row.payment_status,
      amount: Number(row.amount || 0),
      specialty: row.specialty,
      doctor_name: row.doctor_name,
      patient_name: row.patient_name,
    }));

    return res.json({ summary, items });
  } catch (error) {
    console.error('[PaymentService] GET /admin/income error:', error);
    return res.status(500).json({ error: 'Failed to fetch income data' });
  }
});

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
