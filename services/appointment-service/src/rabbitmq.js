const amqp = require('amqplib');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'appointment.events';

let connection;
let channel;

async function connectRabbit() {
  if (channel) {
    return channel;
  }

  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  connection.on('error', (error) => {
    console.error('[AppointmentService] RabbitMQ connection error:', error);
  });

  connection.on('close', () => {
    channel = null;
    connection = null;
    console.warn('[AppointmentService] RabbitMQ connection closed');
  });

  console.log('[AppointmentService] RabbitMQ connected');
  return channel;
}

async function publishEvent(routingKey, payload) {
  try {
    if (!channel) {
      await connectRabbit();
    }

    const message = Buffer.from(JSON.stringify(payload));
    channel.publish(EXCHANGE, routingKey, message, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[AppointmentService] Failed to publish event ${routingKey}:`, error);
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
    console.error('[AppointmentService] Failed to close RabbitMQ:', error);
  }
}

module.exports = { connectRabbit, publishEvent, closeRabbit };
