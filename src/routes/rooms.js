const express = require('express');
const router = express.Router();
const roomService = require('../services/roomService');
const { validateRoomCode } = require('../utils/validators');

/**
 * GET /api/rooms/:code
 * Check if a room exists and get its current state (for pre-join validation).
 */
router.get('/:code', async (req, res, next) => {
  try {
    const code = validateRoomCode(req.params.code);
    const room = await roomService.findRoom(code);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const userCounts = roomService.getUserCounts(room);
    const currentPosition = roomService.computeCurrentPosition(room.playbackState);

    res.json({
      code: room.code,
      hostUsername: room.hostUsername,
      userCounts,
      hasVideo: !!room.playbackState.videoUrl,
      isPlaying: room.playbackState.isPlaying,
      currentPosition,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
