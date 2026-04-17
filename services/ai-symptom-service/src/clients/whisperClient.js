const env = require('../config/env');
const { fetchWithTimeout } = require('../utils/httpClient');
const { ApiError } = require('../utils/errors');

async function transcribe(audioBuffer, contentType = 'audio/webm') {
  const asrFormData = new FormData();
  asrFormData.append('audio_file', new Blob([audioBuffer], { type: contentType }), 'audio.webm');

  const asrResponse = await fetchWithTimeout(`${env.whisper.baseUrl}/asr?task=transcribe&language=en&output=json`, {
    method: 'POST',
    body: asrFormData,
  }, env.whisper.timeoutMs);

  if (asrResponse.ok) {
    const data = await asrResponse.json();
    return data?.text || data?.transcription || '';
  }

  // Fallback for OpenAI-compatible whisper servers.
  const fallbackFormData = new FormData();
  fallbackFormData.append('file', new Blob([audioBuffer], { type: contentType }), 'audio.webm');
  fallbackFormData.append('model', 'whisper-1');

  const fallbackResponse = await fetchWithTimeout(`${env.whisper.baseUrl}/v1/audio/transcriptions`, {
    method: 'POST',
    body: fallbackFormData,
  }, env.whisper.timeoutMs);

  if (!fallbackResponse.ok) {
    const errorText = await fallbackResponse.text();
    throw new ApiError(fallbackResponse.status, 'Failed to transcribe audio', { errorText });
  }

  const fallbackData = await fallbackResponse.json();
  return fallbackData?.text || '';
}

module.exports = {
  transcribe,
};
