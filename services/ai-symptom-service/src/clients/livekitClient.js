const { AccessToken } = require('livekit-server-sdk');
const env = require('../config/env');
const { ApiError } = require('../utils/errors');

function createRoomToken(identity, roomName, metadata = {}) {
  if (!env.livekit.apiKey || !env.livekit.apiSecret) {
    throw new ApiError(500, 'LiveKit credentials are not configured');
  }

  const token = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity,
    ttl: env.livekit.tokenTtlSeconds,
    metadata: JSON.stringify(metadata),
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return {
    url: env.livekit.url,
    token: token.toJwt(),
  };
}

module.exports = {
  createRoomToken,
};
