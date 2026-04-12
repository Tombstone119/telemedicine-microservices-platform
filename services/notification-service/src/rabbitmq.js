const amqp = require('amqplib');
const { processNotificationEvent } = require('./notifications');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'appointment.events';
const QUEUE = process.env.RABBITMQ_QUEUE || 'notification.service.queue';
const ROUTING_KEYS = [
  'appointment.created',
  'appointment.confirmed',
  'appointment.cancelled',
  'payment.completed',
];

let connection;
let channel;

async function connectRabbit() {
  if (channel) return channel;

  const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  connection = await amqp.connect(rabbitUrl);
  channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });

  for (const routingKey of ROUTING_KEYS) {
    await channel.bindQueue(QUEUE, EXCHANGE, routingKey);
  }

  channel.prefetch(10);

  connection.on('error', (error) => {
    console.error('[NotificationService] RabbitMQ connection error:', error);
  });

  connection.on('close', () => {
    console.warn('[NotificationService] RabbitMQ connection closed');
    connection = null;
    channel = null;
  });

  console.log('[NotificationService] RabbitMQ connected and bindings ready');
  return channel;
}

async function startConsumer() {
  const ch = await connectRabbit();

  await ch.consume(
    QUEUE,
    async (msg) => {
      if (!msg) return;

      const routingKey = msg.fields.routingKey;

      try {
        const payload = JSON.parse(msg.content.toString('utf8'));
        await processNotificationEvent(routingKey, payload);
        ch.ack(msg);
      } catch (error) {
        console.error(
          `[NotificationService] Failed processing message (${routingKey}):`,
          error
        );
        ch.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  console.log('[NotificationService] RabbitMQ consumer started');
}

async function closeRabbit() {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
  } catch (error) {
    console.error('[NotificationService] Failed to close RabbitMQ cleanly:', error);
  }
}

module.exports = { connectRabbit, startConsumer, closeRabbit };
