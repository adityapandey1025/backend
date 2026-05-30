const mongoose = require('mongoose');

// ─── PlaybackState Sub-document ────────────────────────────────────────────────
const PlaybackStateSchema = new mongoose.Schema(
  {
    videoUrl: { type: String, default: null },
    videoId: { type: String, default: null },
    position: { type: Number, default: 0 }, // seconds
    isPlaying: { type: Boolean, default: false },
    updatedAt: { type: Number, default: () => Date.now() }, // Unix ms for drift calc
  },
  { _id: false }
);

// ─── Connected User Sub-document ──────────────────────────────────────────────
const ConnectedUserSchema = new mongoose.Schema(
  {
    socketId: { type: String, required: true },
    username: { type: String, required: true, maxlength: 30 },
    deviceType: { type: String, enum: ['desktop', 'mobile'], required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Room Schema ───────────────────────────────────────────────────────────────
const RoomSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 6,
    },
    hostSocketId: { type: String, required: true },
    hostUsername: { type: String, required: true, maxlength: 30 },
    playbackState: { type: PlaybackStateSchema, default: () => ({}) },
    users: { type: [ConnectedUserSchema], default: [] },
    // Limits
    maxUsers: { type: Number, default: 15 },
    maxDesktop: { type: Number, default: 10 },
    maxMobile: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    // Auto-expire inactive rooms after 12 hours
    expireAfterSeconds: 43200,
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
RoomSchema.index({ code: 1 }, { unique: true });
RoomSchema.index({ isActive: 1 });
RoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 43200 });

// ─── Virtual: desktop user count ──────────────────────────────────────────────
RoomSchema.virtual('desktopCount').get(function () {
  return this.users.filter((u) => u.deviceType === 'desktop').length;
});

RoomSchema.virtual('mobileCount').get(function () {
  return this.users.filter((u) => u.deviceType === 'mobile').length;
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
RoomSchema.methods.canJoin = function (deviceType) {
  if (this.users.length >= this.maxUsers) {
    return { allowed: false, reason: 'Room is full (max 15 users).' };
  }
  const desktop = this.users.filter((u) => u.deviceType === 'desktop').length;
  const mobile = this.users.filter((u) => u.deviceType === 'mobile').length;
  if (deviceType === 'desktop' && desktop >= this.maxDesktop) {
    return { allowed: false, reason: 'Desktop limit reached (max 10 desktops).' };
  }
  if (deviceType === 'mobile' && mobile >= this.maxMobile) {
    return { allowed: false, reason: 'Mobile limit reached (max 5 mobiles).' };
  }
  return { allowed: true };
};

module.exports = mongoose.model('Room', RoomSchema);
