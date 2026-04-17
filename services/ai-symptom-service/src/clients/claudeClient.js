const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const { ApiError } = require('../utils/errors');

if (!env.claude.apiKey) {
  console.warn('[AISymptomService] ANTHROPIC_API_KEY is not set — Claude calls will fail');
}

const client = new Anthropic({ apiKey: env.claude.apiKey });

// Claude API requires system to be a top-level param, not a message role.
function splitMessages(messages) {
  const systemMsg = messages.find((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');
  return { system: systemMsg?.content || undefined, messages: rest };
}

async function chat(messages, options = {}) {
  const { system, messages: filtered } = splitMessages(messages);

  let response;
  try {
    response = await client.messages.create({
      model: options.model || env.claude.model,
      max_tokens: options.maxTokens || env.claude.maxTokens,
      temperature: options.temperature ?? 0.2,
      ...(system ? { system } : {}),
      messages: filtered,
    });
  } catch (err) {
    throw new ApiError(502, 'Claude API error', { cause: err.message });
  }

  return response.content[0]?.text || '';
}

async function streamChat(messages, options = {}) {
  const { system, messages: filtered } = splitMessages(messages);

  let stream;
  try {
    stream = await client.messages.create({
      model: options.model || env.claude.model,
      max_tokens: options.maxTokens || env.claude.maxTokens,
      temperature: options.temperature ?? 0.3,
      ...(system ? { system } : {}),
      messages: filtered,
      stream: true,
    });
  } catch (err) {
    throw new ApiError(502, 'Claude API stream error', { cause: err.message });
  }

  let fullText = '';

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const token = event.delta.text || '';
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

module.exports = { chat, streamChat };
