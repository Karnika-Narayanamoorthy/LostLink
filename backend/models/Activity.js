const mongoose = require('mongoose');

/**
 * Activity – personal history log for each student.
 * Every meaningful action (report, claim, approval, return, points)
 * auto-creates one record so the student's full timeline is queryable.
 */

const ACTIVITY_TYPES = [
  'ITEM_REPORTED',       // student submitted a lost/found report
  'ITEM_APPROVED',       // admin approved student's report
  'ITEM_REJECTED',       // admin rejected student's report
  'ITEM_RETURNED',       // item confirmed returned
  'CLAIM_SUBMITTED',     // student submitted a claim
  'CLAIM_APPROVED',      // admin approved student's claim
  'CLAIM_REJECTED',      // admin rejected student's claim
  'POINTS_EARNED',       // contribution points awarded
  'REWARD_ISSUED',       // monthly food coupon issued
  'MONTHLY_WINNER'       // selected as monthly champion
];

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ACTIVITY_TYPES,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Related documents (all optional)
  relatedItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Item',
    default: null
  },
  relatedClaim: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Claim',
    default: null
  },
  relatedContribution: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Contribution',
    default: null
  },
  // Snapshot data kept so activity is readable even if related doc changes
  meta: {
    itemTitle:    { type: String, default: '' },
    itemType:     { type: String, default: '' },   // 'lost' | 'found'
    itemLocation: { type: String, default: '' },
    itemStatus:   { type: String, default: '' },
    claimStatus:  { type: String, default: '' },
    points:       { type: Number, default: 0  },
    adminNote:    { type: String, default: '' }
  }
}, {
  timestamps: true   // createdAt used as event time
});

// ── Compound indexes for efficient per-user queries ──────────────────────────
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ user: 1, type: 1,   createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
