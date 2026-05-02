require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { startConsumer, closeRabbit } = require('./rabbitmq');
const { sendEmail } = require('./notifications');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/config', (req, res) => {
  res.json({
    notificationMode: (process.env.NOTIFICATION_MODE || 'enabled').toLowerCase(),
    brevoConfigured: Boolean(process.env.BREVO_API_KEY),
    senderConfigured: Boolean(process.env.BREVO_SENDER_EMAIL),
    senderNameConfigured: Boolean(process.env.BREVO_SENDER_NAME),
  });
});

app.post('/test/email', async (req, res) => {
  try {
    const toEmail = req.body?.toEmail || req.body?.email;
    const subject = req.body?.subject || 'Notification service test email';
    const body = req.body?.body || 'This is a test email from the notification service.';

    const result = await sendEmail(toEmail, subject, body);
    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('[NotificationService] Test email failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 3006;

async function startServer() {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.warn('[NotificationService] BREVO_API_KEY is not set');
    }
    if (!process.env.BREVO_SENDER_EMAIL) {
      console.warn('[NotificationService] BREVO_SENDER_EMAIL is not set');
    }
    await startConsumer();
    app.listen(PORT, () => {
      console.log(`Notification service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[NotificationService] Startup failed:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await closeRabbit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeRabbit();
  process.exit(0);
});

startServer();
