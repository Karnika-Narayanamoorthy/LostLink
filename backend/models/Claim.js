const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  claimant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verificationAnswer: {
    type: String,
    required: [true, 'Verification answer is required'],
    trim: true,
    select: false   // protect from accidental exposure
  },
  additionalInfo: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    default: ''
  },
  reviewedAt: Date
}, {
  timestamps: true
});

// One pending/approved claim per user per item
claimSchema.index({ item: 1, claimant: 1 }, { unique: true });

module.exports = mongoose.model('Claim', claimSchema);
