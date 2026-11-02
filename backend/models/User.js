const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const CONTRIBUTION_LEVELS = [
  { min: 0,   max: 19,  level: 'New Finder',    badge: 'Starter Badge',  color: '#9ca3af' },
  { min: 20,  max: 49,  level: 'Helpful Finder', badge: 'Bronze Badge',  color: '#cd7f32' },
  { min: 50,  max: 99,  level: 'Trusted Finder', badge: 'Silver Badge',  color: '#9e9e9e' },
  { min: 100, max: 199, level: 'Campus Hero',     badge: 'Gold Badge',   color: '#ffd700' },
  { min: 200, max: Infinity, level: 'LostLink Legend', badge: 'Platinum Badge', color: '#e5e4e2' }
];

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },
  section: {
    type: String,
    trim: true,
    default: ''
  },
  rollNumber: {
    type: String,
    trim: true,
    default: '',
    select: false   // never expose in public queries
  },
  phone: {
    type: String,
    trim: true,
    default: '',
    select: false
  },
  profileImage: {
    type: String,
    default: ''
  },
  isSuspended: {
    type: Boolean,
    default: false
  },

  // ─── Contribution / Reward Fields ───────────────────────────────────────────
  contributionPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  contributionLevel: {
    type: String,
    default: 'New Finder'
  },
  contributionBadge: {
    type: String,
    default: 'Starter Badge'
  },
  contributionBadgeColor: {
    type: String,
    default: '#9ca3af'
  },
  totalFoundReports: {
    type: Number,
    default: 0
  },
  verifiedFoundReports: {
    type: Number,
    default: 0
  },
  successfullyReturnedItems: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ── Hash password before save ────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Compare password ─────────────────────────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ── Recalculate contribution level ───────────────────────────────────────────
userSchema.methods.recalculateLevel = function () {
  const pts = this.contributionPoints;
  const tier = CONTRIBUTION_LEVELS.find(l => pts >= l.min && pts <= l.max)
    || CONTRIBUTION_LEVELS[0];
  this.contributionLevel      = tier.level;
  this.contributionBadge      = tier.badge;
  this.contributionBadgeColor = tier.color;
};

// ── Static: get next level info ───────────────────────────────────────────────
userSchema.statics.getNextLevel = function (currentPoints) {
  const idx = CONTRIBUTION_LEVELS.findIndex(
    l => currentPoints >= l.min && currentPoints <= l.max
  );
  if (idx === -1 || idx >= CONTRIBUTION_LEVELS.length - 1) return null;
  return CONTRIBUTION_LEVELS[idx + 1];
};

module.exports = mongoose.model('User', userSchema);
module.exports.CONTRIBUTION_LEVELS = CONTRIBUTION_LEVELS;
