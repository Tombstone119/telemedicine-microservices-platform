const env = require('../config/env');
const { fetchWithTimeout, requestJson } = require('../utils/httpClient');
const { ApiError } = require('../utils/errors');

async function chat(messages, options = {}) {
  const payload = {
    model: options.model || env.ollama.model,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.2,
    },
    messages,
  };

  if (options.format) {
    payload.format = options.format;
  }

  const data = await requestJson(`${env.ollama.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, {
    timeoutMs: env.ollama.timeoutMs,
    retries: 1,
  });

  return data?.message?.content || '';
}

async function streamChat(messages, options = {}) {
  const payload = {
    model: options.model || env.ollama.model,
    stream: true,
    options: {
      temperature: options.temperature ?? 0.2,
    },
    messages,
  };

  const response = await fetchWithTimeout(`${env.ollama.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, env.ollama.timeoutMs);

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, 'Failed to stream chat response', { errorText });
  }

  if (!response.body) {
    throw new ApiError(500, 'Ollama stream response body is empty');
  }

  let fullText = '';
  let buffer = '';

  for await (const chunk of response.body) {
    buffer += Buffer.from(chunk).toString('utf8');

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        continue;
      }

      const token = parsed?.message?.content || '';
      if (token) {
        fullText += token;
        if (typeof options.onToken === 'function') {
          options.onToken(token);
        }
      }
    }
  }

  return fullText;
}

module.exports = {
  chat,
  streamChat,
};
