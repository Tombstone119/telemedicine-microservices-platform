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
    default:
      return {
        subject: 'Notification',
        emailBody: `Event ${routingKey} received.`,
        smsBody: `Event ${routingKey} received.`,
      };
  }
}

async function sendEmail(toEmail, subject, body) {
  const mode = (process.env.NOTIFICATION_MODE || 'mock').toLowerCase();

  if (!toEmail) {
    console.log('[NotificationService] Skipping email: missing recipient');
    return;
  }

  if (mode === 'mock') {
    console.log(`[NotificationService][MOCK EMAIL] to=${toEmail} subject=${subject} body=${body}`);
    return;
  }

  console.log(`[NotificationService][EMAIL] to=${toEmail} subject=${subject} body=${body}`);
}

async function sendSMS(toPhone, body) {
  const mode = (process.env.NOTIFICATION_MODE || 'mock').toLowerCase();

  if (!toPhone) {
    console.log('[NotificationService] Skipping SMS: missing recipient');
    return;
  }

  if (mode === 'mock') {
    console.log(`[NotificationService][MOCK SMS] to=${toPhone} body=${body}`);
    return;
  }

  console.log(`[NotificationService][SMS] to=${toPhone} body=${body}`);
}

async function processNotificationEvent(routingKey, payload) {
  const { subject, emailBody, smsBody } = formatMessage(routingKey, payload);

  const patientEmail = payload.patient_email || null;
  const doctorEmail = payload.doctor_email || null;
  const patientPhone = payload.patient_phone || null;
  const doctorPhone = payload.doctor_phone || null;

  await sendEmail(patientEmail, subject, emailBody);
  await sendEmail(doctorEmail, subject, emailBody);
  await sendSMS(patientPhone, smsBody);
  await sendSMS(doctorPhone, smsBody);

  console.log(
    `[NotificationService] Processed event ${routingKey} for appointment ${payload.appointment_id}`
  );
}

module.exports = { processNotificationEvent, sendEmail, sendSMS };
