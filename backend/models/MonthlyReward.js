const mongoose = require('mongoose');

/**
 * MonthlyReward – one document per calendar month.
 * Tracks the champion selection, admin confirmation and food coupon issuance.
 */

const REWARD_STATUSES = ['pending_review', 'confirmed', 'issued', 'redeemed', 'expired'];

const monthlyRewardSchema = new mongoose.Schema({
  // ── Period ──────────────────────────────────────────────────────────────────
  month: { type: Number, required: true, min: 1, max: 12 },  // 1–12
  year:  { type: Number, required: true },

  // ── Winner ──────────────────────────────────────────────────────────────────
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    default: null
  },
  winnerName:    { type: String, default: '' },   // snapshot
  winnerSection: { type: String, default: '' },

  // ── Scores at time of selection ──────────────────────────────────────────────
  monthlyPoints:     { type: Number, default: 0 },
  successfulReturns: { type: Number, default: 0 },
  approvedReports:   { type: Number, default: 0 },

  // ── Status workflow ──────────────────────────────────────────────────────────
  // pending_review → confirmed → issued → redeemed | expired
  status: {
    type: String,
    enum: REWARD_STATUSES,
    default: 'pending_review'
  },

  // ── Coupon / reward details (filled in by admin at issuance) ────────────────
  rewardTitle:       { type: String, default: 'Monthly Finder Champion Reward' },
  rewardDescription: { type: String, default: '' },
  rewardValue:       { type: Number, default: 200 },   // ₹ value
  couponCode: {
    type: String,
    default: '',
    select: false   // never returned in public queries
  },

  // ── Admin tracking ───────────────────────────────────────────────────────────
  issuedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  issuedAt:   { type: Date, default: null },
  expiryDate: { type: Date, default: null },
  redeemedAt: { type: Date, default: null },
  adminNote:  { type: String, default: '' },

  // ── Tie flag ─────────────────────────────────────────────────────────────────
  hasTie:      { type: Boolean, default: false },
  tieDetails:  { type: String,  default: '' },

  // ── Notification sent ─────────────────────────────────────────────────────────
  winnerNotified: { type: Boolean, default: false },

  // ── Top 10 snapshot (for history display) ────────────────────────────────────
  topContributors: [
    {
      userId:        mongoose.Schema.Types.ObjectId,
      name:          String,
      section:       String,
      monthlyPoints: Number,
      returns:       Number,
      approvedReports: Number
    }
  ]
}, {
  timestamps: true
});

// ── One record per month/year – prevent duplicates ───────────────────────────
monthlyRewardSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyReward', monthlyRewardSchema);
module.exports.REWARD_STATUSES = REWARD_STATUSES;
