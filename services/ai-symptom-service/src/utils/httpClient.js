const { ApiError } = require('./errors');

const DEFAULT_RETRIES = 2;

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(504, `Request timed out: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJson(url, options = {}, config = {}) {
  const retries = config.retries ?? DEFAULT_RETRIES;
  const timeoutMs = config.timeoutMs ?? 15000;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      const raw = await response.text();
      let body = null;

      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch (parseError) {
          body = { raw };
        }
      }

      if (!response.ok) {
        throw new ApiError(response.status, body?.error || body?.message || 'Upstream request failed', body);
      }

      return body;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(300 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError;
}

module.exports = {
  fetchWithTimeout,
  requestJson,
};
