const env = require('../config/env');
const { fetchWithTimeout } = require('../utils/httpClient');
const { ApiError } = require('../utils/errors');

async function synthesize(text, options = {}) {
  const payload = {
    model: options.model || env.tts.model,
    input: text,
    voice: options.voice || env.tts.voice,
    response_format: options.audioFormat || env.tts.audioFormat,
  };

  const response = await fetchWithTimeout(`${env.tts.baseUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, env.tts.timeoutMs);

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, 'Failed to synthesize speech', { errorText });
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || 'audio/mpeg';

  return {
    mimeType,
    audioBase64: Buffer.from(arrayBuffer).toString('base64'),
  };
}

module.exports = {
  synthesize,
};
