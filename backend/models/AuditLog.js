const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminName: { type: String, default: '' },  // snapshot
  action: {
    type: String,
    required: true,
    enum: [
      'ITEM_APPROVED', 'ITEM_REJECTED', 'ITEM_RETURNED', 'ITEM_CANCELLED',
      'ITEM_DELETED', 'CLAIM_APPROVED', 'CLAIM_REJECTED',
      'USER_SUSPENDED', 'USER_UNSUSPENDED', 'USER_ROLE_CHANGED',
      'REWARD_CONFIRMED', 'REWARD_ISSUED', 'REWARD_REDEEMED', 'REWARD_EXPIRED',
      'POINTS_ADJUSTED', 'MONTHLY_TRIGGERED', 'SETTINGS_CHANGED', 'SYSTEM'
    ]
  },
  targetType: { type: String, enum: ['Item','Claim','User','MonthlyReward','Contribution','System'], default: 'System' },
  targetId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  description: { type: String, required: true, trim: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after:  { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

auditLogSchema.index({ admin: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
