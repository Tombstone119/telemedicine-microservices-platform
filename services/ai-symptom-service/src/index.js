const app = require('./app');
const env = require('./config/env');
const { pool } = require('./db/pool');
const logger = require('./utils/logger');

const server = app.listen(env.port, () => {
  logger.info(`AI symptom service running on port ${env.port}`);
});

async function shutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  server.close(async () => {
    try {
      await pool.end();
      logger.info('Database pool closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
