const amqp = require('amqplib');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'appointment.events';

let connection;
let channel;

async function connectRabbit() {
  if (channel) return channel;

  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  connection.on('error', (error) => {
    console.error('[PaymentService] RabbitMQ connection error:', error);
  });

  connection.on('close', () => {
    connection = null;
    channel = null;
    console.warn('[PaymentService] RabbitMQ connection closed');
  });

  console.log('[PaymentService] RabbitMQ connected');
  return channel;
}

async function publishEvent(routingKey, payload) {
  try {
    if (!channel) {
      await connectRabbit();
    }

    channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
      contentType: 'application/json',
      persistent: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[PaymentService] Failed to publish event ${routingKey}:`, error);
  }
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
    console.error('[PaymentService] Failed to close RabbitMQ:', error);
  }
}

module.exports = { connectRabbit, publishEvent, closeRabbit };
