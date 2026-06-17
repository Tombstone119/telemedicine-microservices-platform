let amqp;

try {
  // eslint-disable-next-line global-require
  amqp = require('amqplib');
} catch (error) {
  amqp = null;
  console.warn('[AuthService] amqplib is not installed; RabbitMQ publish is disabled');
}

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'appointment.events';

let connection;
let channel;

async function connectRabbit() {
  if (!amqp) {
    return null;
  }

  if (channel) return channel;

  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  connection.on('error', (error) => {
    console.error('[AuthService] RabbitMQ connection error:', error);
  });

  connection.on('close', () => {
    connection = null;
    channel = null;
    console.warn('[AuthService] RabbitMQ connection closed');
  });

  console.log('[AuthService] RabbitMQ connected');
  return channel;
}

async function publishEvent(routingKey, payload) {
  try {
    if (!amqp) {
      return;
    }

    if (!channel) {
      await connectRabbit();
    }

    channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
      contentType: 'application/json',
      persistent: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[AuthService] Failed to publish event ${routingKey}:`, error);
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
    console.error('[AuthService] Error closing RabbitMQ:', error);
  }
}

module.exports = {
  connectRabbit,
  publishEvent,
  closeRabbit,
};
