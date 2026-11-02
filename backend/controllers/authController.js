const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ── Generate JWT ──────────────────────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const safe = {
    _id:                      user._id,
    name:                     user.name,
    email:                    user.email,
    role:                     user.role,
    section:                  user.section,
    profileImage:             user.profileImage,
    contributionPoints:       user.contributionPoints,
    contributionLevel:        user.contributionLevel,
    contributionBadge:        user.contributionBadge,
    contributionBadgeColor:   user.contributionBadgeColor,
    totalFoundReports:        user.totalFoundReports,
    verifiedFoundReports:     user.verifiedFoundReports,
    successfullyReturnedItems:user.successfullyReturnedItems,
    createdAt:                user.createdAt
  };
  res.status(statusCode).json({ success: true, token, user: safe });
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, section } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, section: section || '' });
    sendToken(user, 201, res);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ success: false, message: 'Account suspended' });
    }

    sendToken(user, 200, res);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const nextLevel = User.getNextLevel(user.contributionPoints);
    res.json({
      success: true,
      user: {
        _id:                       user._id,
        name:                      user.name,
        email:                     user.email,
        role:                      user.role,
        section:                   user.section,
        profileImage:              user.profileImage,
        contributionPoints:        user.contributionPoints,
        contributionLevel:         user.contributionLevel,
        contributionBadge:         user.contributionBadge,
        contributionBadgeColor:    user.contributionBadgeColor,
        totalFoundReports:         user.totalFoundReports,
        verifiedFoundReports:      user.verifiedFoundReports,
        successfullyReturnedItems: user.successfullyReturnedItems,
        nextLevel,
        createdAt:                 user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { name, section } = req.body;
    const update = {};
    if (name)    update.name    = name.trim();
    if (section !== undefined) update.section = section.trim();

    const user = await User.findByIdAndUpdate(req.user._id, update, {
      new: true, runValidators: true
    });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
