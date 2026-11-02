const mongoose = require('mongoose');

// Stores computed match pairs for admin review and deduplication
const matchSchema = new mongoose.Schema({
  foundItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  lostItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  label: {
    type: String,
    enum: ['High', 'Possible'],
    required: true
  },
  scoreBreakdown: {
    category:     { type: Number, default: 0 },
    title:        { type: Number, default: 0 },
    description:  { type: Number, default: 0 },
    location:     { type: Number, default: 0 },
    date:         { type: Number, default: 0 }
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: Date
}, {
  timestamps: true
});

// Unique match pair (one direction only: found → lost)
matchSchema.index({ foundItem: 1, lostItem: 1 }, { unique: true });
matchSchema.index({ foundItem: 1, score: -1 });

module.exports = mongoose.model('Match', matchSchema);
