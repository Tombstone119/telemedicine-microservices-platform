const express = require('express');
const { pool } = require('../db');
const { publishEvent } = require('../rabbitmq');
const { stripe } = require('../stripe');

const router = express.Router();

const PLATFORM_FEE_PERCENT = 0.20; // 20% platform fee
const DOCTOR_PERCENT = 0.80; // 80% to doctor

function generateReceiptNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `RCP-${timestamp}-${random}`;
}

router.post('/', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    if (webhookSecret) {
      if (!signature) {
        return res.status(400).send('Missing Stripe signature');
      }

      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString('utf8'));
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const appointmentId = parseInt(paymentIntent.metadata?.appointment_id, 10);

      if (!Number.isNaN(appointmentId)) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Get appointment and doctor details with user emails
          const appointmentResult = await client.query(
            `
              SELECT a.id, a.patient_id, a.doctor_id, a.appointment_time, a.status, a.payment_status,
                     d.consultation_fee, d.user_id as doctor_user_id,
                     u_patient.email as patient_email, u_patient.phone as patient_phone,
                     u_doctor.email as doctor_email, u_doctor.phone as doctor_phone
              FROM appointments a
              JOIN doctors d ON d.id = a.doctor_id
              LEFT JOIN users u_patient ON u_patient.id = a.patient_id
              LEFT JOIN users u_doctor ON u_doctor.id = d.user_id
              WHERE a.id = $1
            `,
            [appointmentId]
          );

          if (appointmentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Appointment not found' });
          }

          const appointment = appointmentResult.rows[0];
          const totalAmount = Number(appointment.consultation_fee || 0);
          const platformFee = Math.round(totalAmount * PLATFORM_FEE_PERCENT * 100) / 100;
          const doctorAmount = Math.round(totalAmount * DOCTOR_PERCENT * 100) / 100;

          // Update appointment status to completed
          await client.query(
            `
              UPDATE appointments
              SET payment_status = 'paid',
                  status = 'completed',
                  paid_at = COALESCE(paid_at, NOW())
              WHERE id = $1
                AND payment_status <> 'paid'
            `,
            [appointmentId]
          );

          // Create doctor earnings record
          const earningsResult = await client.query(
            `
              INSERT INTO doctor_earnings 
              (doctor_id, appointment_id, total_amount, platform_fee, doctor_amount, payment_status)
              VALUES ($1, $2, $3, $4, $5, 'completed')
              RETURNING id
            `,
            [appointment.doctor_id, appointmentId, totalAmount, platformFee, doctorAmount]
          );

          // Create payment receipt
          const receiptNumber = generateReceiptNumber();
          await client.query(
            `
              INSERT INTO payment_receipts 
              (appointment_id, doctor_id, patient_id, receipt_number, total_amount, platform_fee, doctor_amount)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [appointmentId, appointment.doctor_id, appointment.patient_id, receiptNumber, totalAmount, platformFee, doctorAmount]
          );

          // Update or create doctor wallet
          const walletResult = await client.query(
            `
              SELECT id, balance, total_earned FROM doctor_wallets WHERE doctor_id = $1
            `,
            [appointment.doctor_id]
          );

          if (walletResult.rows.length > 0) {
            // Update existing wallet
            const wallet = walletResult.rows[0];
            await client.query(
              `
                UPDATE doctor_wallets
                SET balance = balance + $1,
                    total_earned = total_earned + $1,
                    updated_at = NOW()
                WHERE doctor_id = $2
              `,
              [doctorAmount, appointment.doctor_id]
            );
          } else {
            // Create new wallet
            await client.query(
              `
                INSERT INTO doctor_wallets (doctor_id, balance, total_earned, updated_at)
                VALUES ($1, $2, $2, NOW())
              `,
              [appointment.doctor_id, doctorAmount]
            );
          }

          await client.query('COMMIT');

          // Publish event
          await publishEvent('payment.completed', {
            appointment_id: appointmentId,
            patient_id: appointment.patient_id,
            doctor_id: appointment.doctor_id,
            patient_email: appointment.patient_email,
            patient_phone: appointment.patient_phone,
            doctor_email: appointment.doctor_email,
            doctor_phone: appointment.doctor_phone,
            appointment_time: appointment.appointment_time,
            status: 'completed',
            payment_status: 'paid',
            total_amount: totalAmount,
            platform_fee: platformFee,
            doctor_amount: doctorAmount,
            receipt_number: receiptNumber,
            stripe_payment_intent_id: paymentIntent.id,
            paid_at: new Date().toISOString(),
          });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[PaymentService] POST /webhook/stripe error:', error);
    return res.status(400).send('Webhook error');
  }
});

module.exports = router;
