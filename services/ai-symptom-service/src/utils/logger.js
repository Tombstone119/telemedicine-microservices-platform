function log(level, message, meta) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'ai-symptom-service',
    message,
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

module.exports = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};
