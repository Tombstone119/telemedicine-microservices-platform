const axios = require('axios');

const BREVO_API_URL = 'https://api.brevo.com/v3';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const SENDER_NAME = process.env.BREVO_SENDER_NAME;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEmail(value) {
  if (!value) return null;

  const email = String(value).trim();
  return email.length > 0 ? email : null;
}

function collectRecipients(payload) {
  const candidates = [
    payload.patient_email,
    payload.doctor_email,
    payload.patientEmail,
    payload.doctorEmail,
    payload.email,
    payload.to_email,
    payload.toEmail,
    payload.recipient_email,
    payload.recipientEmail,
  ];

  if (Array.isArray(payload.recipients)) {
    for (const recipient of payload.recipients) {
      if (typeof recipient === 'string') {
        candidates.push(recipient);
      } else if (recipient && typeof recipient === 'object') {
        candidates.push(recipient.email, recipient.toEmail);
      }
    }
  }

  return [...new Set(candidates.map(normalizeEmail).filter(Boolean))];
}

function formatMessage(routingKey, payload) {
  switch (routingKey) {
    case 'appointment.created':
      return {
        subject: 'Appointment Created',
        emailBody: `Your appointment #${payload.appointment_id} is created for ${payload.appointment_time}.`,
        smsBody: `Appointment #${payload.appointment_id} created for ${payload.appointment_time}.`,
      };
    case 'appointment.confirmed':
      return {
        subject: 'Appointment Confirmed',
        emailBody: `Your appointment #${payload.appointment_id} is confirmed for ${payload.appointment_time}.`,
        smsBody: `Appointment #${payload.appointment_id} confirmed.`,
      };
    case 'appointment.cancelled':
      return {
        subject: 'Appointment Cancelled',
        emailBody: `Your appointment #${payload.appointment_id} has been cancelled.`,
        smsBody: `Appointment #${payload.appointment_id} cancelled.`,
      };
    case 'payment.completed':
      return {
        subject: 'Payment Completed',
        emailBody: `Payment received for appointment #${payload.appointment_id}.`,
        smsBody: `Payment completed for appointment #${payload.appointment_id}.`,
      };
    case 'appointment.completed':
      return {
        subject: 'Appointment Completed',
        emailBody: `Your appointment #${payload.appointment_id} has been marked as completed.`,
        smsBody: `Appointment #${payload.appointment_id} completed.`,
      };
    case 'user.registered':
      return {
        subject: 'Welcome to our Telemedicine Platform',
        emailBody: `Hello ${payload.full_name}, welcome to our platform! Your account has been successfully created.`,
        smsBody: `Welcome to our platform!`,
      };
    case 'doctor.verification_approved':
      return {
        subject: 'Doctor Account Verified',
        emailBody: `Congratulations! Your doctor account has been verified and approved. You can now accept appointments. Notes: ${payload.notes || 'None'}`,
        smsBody: `Your doctor account has been approved.`,
      };
    case 'doctor.verification_rejected':
      return {
        subject: 'Doctor Account Verification Rejected',
        emailBody: `Unfortunately, your doctor account verification was rejected. Reason: ${payload.notes || 'Not provided'}`,
        smsBody: `Your doctor account verification was rejected.`,
      };
    default:
      return {
        subject: 'Notification',
        emailBody: `Event ${routingKey} received.`,
        smsBody: `Event ${routingKey} received.`,
      };
  }
}

async function sendEmail(toEmail, subject, body) {
  const mode = (process.env.NOTIFICATION_MODE || 'enabled').toLowerCase();

  if (!toEmail) {
    console.log('[NotificationService] Skipping email: missing recipient');
    return { ok: false, skipped: true, reason: 'missing_recipient' };
  }

  if (mode === 'disabled') {
    console.log('[NotificationService] Email delivery is disabled by configuration');
    return { ok: true, skipped: true, reason: 'disabled' };
  }

  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is missing');
  }

  try {
    const response = await axios.post(
      `${BREVO_API_URL}/smtp/email`,
      {
        sender: {
          name: SENDER_NAME || 'Notification Service',
          email: SENDER_EMAIL,
        },
        to: [{ email: toEmail }],
        subject: subject,
        htmlContent: `<p>${escapeHtml(body).replace(/\n/g, '<br />')}</p>`,
      },
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    console.log(`[NotificationService] Email sent to ${toEmail}, messageId: ${response.data.messageId}`);
    return { ok: true, messageId: response.data.messageId };
  } catch (error) {
    console.error('[NotificationService] Brevo email error:', {
      recipient: toEmail,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return { ok: false, error: error.response?.data || error.message };
  }
}

async function sendSMS(toPhone, body) {
  const mode = (process.env.NOTIFICATION_MODE || 'enabled').toLowerCase();

  if (!toPhone) {
    console.log('[NotificationService] Skipping SMS: missing recipient');
    return { ok: false, skipped: true, reason: 'missing_recipient' };
  }

  if (mode === 'disabled') {
    console.log('[NotificationService] SMS delivery is disabled by configuration');
    return { ok: true, skipped: true, reason: 'disabled' };
  }

  console.log(`[NotificationService][SMS] to=${toPhone} body=${body}`);
  return { ok: true, skipped: true, reason: 'mock' };
}

async function processNotificationEvent(routingKey, payload) {
  const { subject, emailBody, smsBody } = formatMessage(routingKey, payload);

  const recipients = collectRecipients(payload);
  const patientPhone = payload.patient_phone || payload.patientPhone || null;
  const doctorPhone = payload.doctor_phone || payload.doctorPhone || null;

  if (recipients.length === 0) {
    console.warn(
      `[NotificationService] No email recipients found for event ${routingKey} and appointment ${payload.appointment_id}`
    );
  }

  for (const recipient of recipients) {
    await sendEmail(recipient, subject, emailBody);
  }

  await sendSMS(patientPhone, smsBody);
  await sendSMS(doctorPhone, smsBody);

  console.log(
    `[NotificationService] Processed event ${routingKey} for appointment ${payload.appointment_id}`
  );

  return { recipients };
}

module.exports = { processNotificationEvent, sendEmail, sendSMS, collectRecipients, formatMessage };
