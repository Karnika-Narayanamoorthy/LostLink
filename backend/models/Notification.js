const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'ITEM_MATCH',      // Smart matching notification
  'CLAIM_UPDATE',    // Claim approved/rejected
  'ITEM_UPDATE',     // Item status changed
  'SYSTEM'           // System messages
];

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    enum: NOTIFICATION_TYPES,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  relatedItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    default: null
  },
  relatedLostItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    default: null
  },
  matchScore: {
    type: Number,
    default: null
  },
  matchLabel: {
    type: String,
    enum: ['High', 'Possible', null],
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// ── Deduplication: one ITEM_MATCH notification per (recipient, relatedItem, relatedLostItem)
notificationSchema.index(
  { recipient: 1, type: 1, relatedItem: 1, relatedLostItem: 1 },
  { unique: true, partialFilterExpression: { type: 'ITEM_MATCH' } }
);

// ── Performance indexes ───────────────────────────────────────────────────────
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
