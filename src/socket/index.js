const { Server } = require('socket.io');
const roomService = require('../services/roomService');
const { validateJoinPayload, validateVideoUrl } = require('../utils/validators');
const logger = require('../utils/logger');

const DRIFT_THRESHOLD_MS = 500; // 500ms drift tolerance
const SYNC_INTERVAL_MS = 5000; // Client syncs every 5s

let io;

function initSocket(server) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // ── CREATE ROOM ──────────────────────────────────────────────────────────
    socket.on('create-room', async (payload) => {
      try {
        const { username, deviceType } = validateJoinPayload(payload);
        const room = await roomService.createRoom({
          hostSocketId: socket.id,
          username,
          deviceType,
        });

        socket.join(room.code);
        socket.data.roomCode = room.code;
        socket.data.username = username;
        socket.data.deviceType = deviceType;

        socket.emit('room-created', {
          roomCode: room.code,
          isHost: true,
          username,
          users: room.users,
          userCounts: roomService.getUserCounts(room),
          playbackState: room.playbackState,
        });

        logger.info(`Room ${room.code} created by ${username}`);
      } catch (err) {
        logger.error('create-room error:', err);
        socket.emit('error-message', { event: 'create-room', message: err.message });
      }
    });

    // ── JOIN ROOM ────────────────────────────────────────────────────────────
    socket.on('join-room', async (payload) => {
      try {
        const { username, deviceType, roomCode } = validateJoinPayload(payload);
        const result = await roomService.joinRoom({
          code: roomCode,
          socketId: socket.id,
          username,
          deviceType,
        });

        if (!result.success) {
          return socket.emit('error-message', { event: 'join-room', message: result.error });
        }

        const { room } = result;
        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.username = username;
        socket.data.deviceType = deviceType;

        const currentPosition = roomService.computeCurrentPosition(room.playbackState);
        const userCounts = roomService.getUserCounts(room);

        // Tell the joining user the current room state
        socket.emit('room-joined', {
          roomCode,
          isHost: room.hostSocketId === socket.id,
          hostSocketId: room.hostSocketId,
          username,
          users: room.users,
          userCounts,
          playbackState: {
            ...room.playbackState.toObject(),
            position: currentPosition,
          },
        });

        // Notify everyone else a new user joined
        socket.to(roomCode).emit('user-count', {
          users: room.users,
          userCounts,
          joined: username,
        });

        logger.info(`${username} joined room ${roomCode}`);
      } catch (err) {
        logger.error('join-room error:', err);
        socket.emit('error-message', { event: 'join-room', message: err.message });
      }
    });

    // ── LEAVE ROOM ───────────────────────────────────────────────────────────
    socket.on('leave-room', async () => {
      await handleLeave(socket);
    });

    // ── VIDEO CHANGE ─────────────────────────────────────────────────────────
    socket.on('video-change', async ({ videoUrl }) => {
      try {
        const roomCode = socket.data.roomCode;
        if (!roomCode) return;

        const validUrl = validateVideoUrl(videoUrl);
        const room = await roomService.updatePlayback({
          code: roomCode,
          videoUrl: validUrl,
          position: 0,
          isPlaying: false,
        });

        if (!room) return socket.emit('error-message', { event: 'video-change', message: 'Room not found.' });

        // Broadcast to everyone in room including sender
        io.to(roomCode).emit('video-changed', {
          videoUrl: validUrl,
          videoId: room.playbackState.videoId,
          position: 0,
          isPlaying: false,
        });
      } catch (err) {
        logger.error('video-change error:', err);
        socket.emit('error-message', { event: 'video-change', message: err.message });
      }
    });

    // ── PLAY VIDEO ───────────────────────────────────────────────────────────
    socket.on('play-video', async ({ position }) => {
      try {
        const roomCode = socket.data.roomCode;
        if (!roomCode) return;

        const pos = typeof position === 'number' ? position : 0;
        await roomService.updatePlayback({ code: roomCode, position: pos, isPlaying: true });

        socket.to(roomCode).emit('video-play', { position: pos, ts: Date.now() });
      } catch (err) {
        logger.error('play-video error:', err);
      }
    });

    // ── PAUSE VIDEO ──────────────────────────────────────────────────────────
    socket.on('pause-video', async ({ position }) => {
      try {
        const roomCode = socket.data.roomCode;
        if (!roomCode) return;

        const pos = typeof position === 'number' ? position : 0;
        await roomService.updatePlayback({ code: roomCode, position: pos, isPlaying: false });

        socket.to(roomCode).emit('video-pause', { position: pos, ts: Date.now() });
      } catch (err) {
        logger.error('pause-video error:', err);
      }
    });

    // ── SEEK VIDEO ───────────────────────────────────────────────────────────
    socket.on('seek-video', async ({ position }) => {
      try {
        const roomCode = socket.data.roomCode;
        if (!roomCode) return;

        if (typeof position !== 'number') return;
        await roomService.updatePlayback({ code: roomCode, position });

        socket.to(roomCode).emit('video-seek', { position, ts: Date.now() });
      } catch (err) {
        logger.error('seek-video error:', err);
      }
    });

    // ── SYNC REQUEST (drift correction) ──────────────────────────────────────
    socket.on('sync-request', async ({ clientPosition }) => {
      try {
        const roomCode = socket.data.roomCode;
        if (!roomCode) return;

        const room = await roomService.findRoom(roomCode);
        if (!room) return;

        const serverPosition = roomService.computeCurrentPosition(room.playbackState);
        const driftMs = Math.abs(serverPosition - clientPosition) * 1000;

        // Only correct if drift exceeds threshold
        if (driftMs > DRIFT_THRESHOLD_MS) {
          socket.emit('sync-state', {
            position: serverPosition,
            isPlaying: room.playbackState.isPlaying,
            videoUrl: room.playbackState.videoUrl,
            videoId: room.playbackState.videoId,
            driftMs: Math.round(driftMs),
          });
          logger.info(`Drift correction: ${socket.data.username} drift=${Math.round(driftMs)}ms`);
        }
      } catch (err) {
        logger.error('sync-request error:', err);
      }
    });

    // ── DISCONNECT ───────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: ${socket.id} [${reason}]`);
      await handleLeave(socket);
    });
  });

  return io;
}

async function handleLeave(socket) {
  try {
    const { roomCode, username } = socket.data;
    if (!roomCode) return;

    const result = await roomService.leaveRoom({ code: roomCode, socketId: socket.id });
    if (!result) return;

    socket.leave(roomCode);
    socket.data.roomCode = null;

    if (result.roomClosed) {
      // Notify remaining sockets (shouldn't be any, but just in case)
      io.to(roomCode).emit('error-message', { event: 'room-closed', message: 'Room has been closed.' });
      return;
    }

    const userCounts = roomService.getUserCounts(result.room);

    // If host changed, notify new host
    if (result.newHostSocketId) {
      io.to(result.newHostSocketId).emit('room-joined', {
        roomCode,
        isHost: true,
        hostSocketId: result.newHostSocketId,
        users: result.room.users,
        userCounts,
        playbackState: result.room.playbackState,
      });
    }

    // Notify remaining users of updated count
    io.to(roomCode).emit('user-count', {
      users: result.room.users,
      userCounts,
      left: username,
      newHostSocketId: result.newHostSocketId,
    });
  } catch (err) {
    logger.error('handleLeave error:', err);
  }
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

module.exports = { initSocket, getIO };
