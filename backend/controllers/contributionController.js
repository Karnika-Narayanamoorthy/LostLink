const mongoose     = require('mongoose');
const User         = require('../models/User');
const Contribution = require('../models/Contribution');

const safeId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── GET /api/contributions/me ─────────────────────────────────────────────────
exports.getMySummary = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const nextLevel = User.getNextLevel(user.contributionPoints);

    res.json({
      success: true,
      summary: {
        contributionPoints:        user.contributionPoints,
        contributionLevel:         user.contributionLevel,
        contributionBadge:         user.contributionBadge,
        contributionBadgeColor:    user.contributionBadgeColor,
        totalFoundReports:         user.totalFoundReports,
        verifiedFoundReports:      user.verifiedFoundReports,
        successfullyReturnedItems: user.successfullyReturnedItems,
        nextLevel
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/contributions/history ────────────────────────────────────────────
exports.getMyHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Contribution.countDocuments({ user: req.user._id });

    const history = await Contribution.find({ user: req.user._id })
      .populate('item', 'title type location image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const formatted = history.map(h => {
      const obj = h.toObject();
      if (obj.item && obj.item.image) {
        obj.item.imageUrl = `${baseUrl}/uploads/${obj.item.image}`;
      }
      return obj;
    });

    res.json({
      success: true,
      total,
      page:       parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      history:    formatted
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/contributions/leaderboard ────────────────────────────────────────
exports.getLeaderboard = async (req, res) => {
  try {
    const { filter = 'overall', limit = 20 } = req.query;

    // For monthly / weekly, we sum contribution records within the window
    if (filter === 'monthly' || filter === 'weekly') {
      const now    = new Date();
      const cutoff = new Date(now);
      if (filter === 'weekly')  cutoff.setDate(cutoff.getDate() - 7);
      if (filter === 'monthly') cutoff.setMonth(cutoff.getMonth() - 1);

      const agg = await Contribution.aggregate([
        { $match: { createdAt: { $gte: cutoff } } },
        { $group: { _id: '$user', periodPoints: { $sum: '$points' }, actions: { $sum: 1 } } },
        { $sort:  { periodPoints: -1, actions: -1 } },
        { $limit: parseInt(limit, 10) },
        { $lookup: {
            from:         'users',
            localField:   '_id',
            foreignField: '_id',
            as:           'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        { $match:  { 'userInfo.isSuspended': false } },
        { $project: {
            _id:              0,
            userId:           '$_id',
            name:             '$userInfo.name',
            section:          '$userInfo.section',
            // Overall stats for context
            totalPoints:               '$userInfo.contributionPoints',
            contributionLevel:         '$userInfo.contributionLevel',
            contributionBadge:         '$userInfo.contributionBadge',
            contributionBadgeColor:    '$userInfo.contributionBadgeColor',
            successfullyReturnedItems: '$userInfo.successfullyReturnedItems',
            // Period stats
            periodPoints: 1
          }
        }
      ]);

      const ranked = agg.map((u, i) => ({ rank: i + 1, ...u }));
      return res.json({ success: true, filter, leaderboard: ranked });
    }

    // Overall leaderboard
    const users = await User.find({ isSuspended: false })
      .select('name section contributionPoints contributionLevel contributionBadge contributionBadgeColor successfullyReturnedItems')
      .sort({ contributionPoints: -1, successfullyReturnedItems: -1, createdAt: 1 })
      .limit(parseInt(limit, 10));

    const leaderboard = users.map((u, i) => ({
      rank:                      i + 1,
      userId:                    u._id,
      name:                      u.name,
      section:                   u.section,
      totalPoints:               u.contributionPoints,
      contributionLevel:         u.contributionLevel,
      contributionBadge:         u.contributionBadge,
      contributionBadgeColor:    u.contributionBadgeColor,
      successfullyReturnedItems: u.successfullyReturnedItems
    }));

    res.json({ success: true, filter, leaderboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/contributions/users/:id  (public-safe profile) ──────────────────
exports.getUserContribution = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const user = await User.findById(req.params.id)
      .select('name section contributionPoints contributionLevel contributionBadge contributionBadgeColor totalFoundReports verifiedFoundReports successfullyReturnedItems');

    if (!user || user.isSuspended) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── ADMIN: GET /api/admin/contributions ───────────────────────────────────────
exports.adminGetContributions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Contribution.countDocuments();

    const history = await Contribution.find()
      .populate('user', 'name email section contributionPoints contributionLevel')
      .populate('item', 'title type location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({ success: true, total, history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
