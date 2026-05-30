const { customAlphabet } = require('nanoid');
const Room = require('../models/Room');
const logger = require('../utils/logger');
const { extractVideoId } = require('../utils/youtube');

// 6-char uppercase alphanumeric code (no ambiguous chars 0, O, I, l)
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

class RoomService {
  /**
   * Create a new room and persist to MongoDB.
   */
  async createRoom({ hostSocketId, username, deviceType }) {
    let code;
    let attempts = 0;
    // Ensure unique code (collision extremely rare but handle it)
    do {
      code = generateCode();
      attempts++;
      if (attempts > 10) throw new Error('Could not generate unique room code');
    } while (await Room.exists({ code }));

    const room = await Room.create({
      code,
      hostSocketId,
      hostUsername: username,
      users: [{ socketId: hostSocketId, username, deviceType }],
    });

    logger.info(`Room created: ${code} by ${username} [${deviceType}]`);
    return room;
  }

  /**
   * Find a room by code.
   */
  async findRoom(code) {
    return Room.findOne({ code: code.toUpperCase(), isActive: true });
  }

  /**
   * Add a user to a room after validating capacity.
   */
  async joinRoom({ code, socketId, username, deviceType }) {
    const room = await this.findRoom(code);
    if (!room) return { success: false, error: 'Room not found.' };

    const check = room.canJoin(deviceType);
    if (!check.allowed) return { success: false, error: check.reason };

    // Avoid duplicate socket IDs
    if (!room.users.find((u) => u.socketId === socketId)) {
      room.users.push({ socketId, username, deviceType });
      await room.save();
    }

    logger.info(`User ${username} joined room ${code}`);
    return { success: true, room };
  }

  /**
   * Remove a user from a room; promote a new host if needed.
   */
  async leaveRoom({ code, socketId }) {
    const room = await Room.findOne({ code, isActive: true });
    if (!room) return null;

    room.users = room.users.filter((u) => u.socketId !== socketId);

    // If no users left, mark room inactive
    if (room.users.length === 0) {
      room.isActive = false;
      await room.save();
      logger.info(`Room ${code} deactivated (empty)`);
      return { room, newHostSocketId: null, roomClosed: true };
    }

    let newHostSocketId = null;
    // If host left, promote the first remaining user
    if (room.hostSocketId === socketId) {
      const newHost = room.users[0];
      room.hostSocketId = newHost.socketId;
      room.hostUsername = newHost.username;
      newHostSocketId = newHost.socketId;
      logger.info(`Host left ${code}. New host: ${newHost.username}`);
    }

    await room.save();
    return { room, newHostSocketId, roomClosed: false };
  }

  /**
   * Update playback state atomically.
   */
  async updatePlayback({ code, videoUrl, position, isPlaying }) {
    const update = {
      'playbackState.updatedAt': Date.now(),
    };

    if (videoUrl !== undefined) {
      update['playbackState.videoUrl'] = videoUrl;
      update['playbackState.videoId'] = extractVideoId(videoUrl);
    }
    if (position !== undefined) update['playbackState.position'] = position;
    if (isPlaying !== undefined) update['playbackState.isPlaying'] = isPlaying;

    return Room.findOneAndUpdate({ code, isActive: true }, { $set: update }, { new: true });
  }

  /**
   * Compute current server-authoritative position.
   * Accounts for elapsed time since last update when playing.
   */
  computeCurrentPosition(playbackState) {
    if (!playbackState) return 0;
    const { position, isPlaying, updatedAt } = playbackState;
    if (!isPlaying) return position;
    const elapsed = (Date.now() - updatedAt) / 1000;
    return position + elapsed;
  }

  /**
   * Get room user counts for client display.
   */
  getUserCounts(room) {
    const desktop = room.users.filter((u) => u.deviceType === 'desktop').length;
    const mobile = room.users.filter((u) => u.deviceType === 'mobile').length;
    return {
      total: room.users.length,
      desktop,
      mobile,
      maxTotal: room.maxUsers,
      maxDesktop: room.maxDesktop,
      maxMobile: room.maxMobile,
    };
  }
}

module.exports = new RoomService();
