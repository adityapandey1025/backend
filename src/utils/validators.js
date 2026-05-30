const { extractVideoId } = require('./youtube');

/**
 * Validates a YouTube URL and extracts the video ID.
 * Throws if invalid.
 */
function validateVideoUrl(url) {
  if (!url || typeof url !== 'string') throw new Error('A YouTube URL is required.');
  const trimmed = url.trim();
  const id = extractVideoId(trimmed);
  if (!id) throw new Error('Invalid YouTube URL. Please use a valid youtube.com or youtu.be link.');
  return trimmed;
}

/**
 * Validates join/create payload from socket events.
 */
function validateJoinPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload.');
  }

  const { username, deviceType, roomCode } = payload;

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    throw new Error('Username is required.');
  }
  if (username.trim().length > 30) {
    throw new Error('Username must be 30 characters or fewer.');
  }
  if (!['desktop', 'mobile'].includes(deviceType)) {
    throw new Error('Device type must be "desktop" or "mobile".');
  }

  const result = { username: username.trim(), deviceType };

  if (roomCode !== undefined) {
    if (typeof roomCode !== 'string' || !/^[A-Z2-9]{6}$/i.test(roomCode)) {
      throw new Error('Room code must be exactly 6 alphanumeric characters.');
    }
    result.roomCode = roomCode.toUpperCase();
  }

  return result;
}

/**
 * Validates a room code string.
 */
function validateRoomCode(code) {
  if (!code || !/^[A-Z2-9]{6}$/i.test(code)) {
    throw new Error('Invalid room code format.');
  }
  return code.toUpperCase();
}

module.exports = { validateVideoUrl, validateJoinPayload, validateRoomCode };
