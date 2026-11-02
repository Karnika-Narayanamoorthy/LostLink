const mongoose = require('mongoose');

const CONTRIBUTION_ACTIONS = ['REPORT_APPROVED', 'ITEM_RETURNED'];

const contributionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  action: {
    type: String,
    enum: CONTRIBUTION_ACTIONS,
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// ── Unique constraint: one record per (user, item, action) ───────────────────
// This is the primary mechanism preventing duplicate point awards.
contributionSchema.index(
  { user: 1, item: 1, action: 1 },
  { unique: true }
);

// ── Performance indexes ───────────────────────────────────────────────────────
contributionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Contribution', contributionSchema);
module.exports.CONTRIBUTION_ACTIONS = CONTRIBUTION_ACTIONS;
