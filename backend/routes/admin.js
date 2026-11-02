const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  adminGetItems, adminUpdateStatus, adminGetMatches, adminGetClaims, adminUpdateClaim
} = require('../controllers/itemController');
const { adminGetContributions } = require('../controllers/contributionController');
const {
  adminGetAllRewards, adminConfirmWinner, adminIssueCoupon,
  adminMarkRedeemed, adminMarkExpired, adminTriggerMonth
} = require('../controllers/rewardController');
const User          = require('../models/User');
const AuditLog      = require('../models/AuditLog');
const mongoose      = require('mongoose');

const safeId = id => mongoose.Types.ObjectId.isValid(id);

// ── Helper: write audit log ───────────────────────────────────────────────────
async function audit(req, action, targetType, targetId, description, before = null, after = null) {
  try {
    await AuditLog.create({
      admin:       req.user._id,
      adminName:   req.user.name,
      action, targetType, targetId, description, before, after
    });
  } catch(e) { console.error('AuditLog error:', e.message); }
}

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const Item          = require('../models/Item');
    const Claim         = require('../models/Claim');
    const Match         = require('../models/Match');
    const MonthlyReward = require('../models/MonthlyReward');
    const Contribution  = require('../models/Contribution');

    const [
      totalItems, pendingItems, approvedItems, returnedItems, rejectedItems,
      totalLostItems, totalFoundItems,
      totalUsers, activeUsers, suspendedUsers,
      totalClaims, pendingClaims, approvedClaims, rejectedClaims,
      totalMatches, unsentMatches,
      pendingRewards, issuedRewards,
      totalContributions, totalPointsArr
    ] = await Promise.all([
      Item.countDocuments(),
      Item.countDocuments({ status: 'pending' }),
      Item.countDocuments({ status: 'approved' }),
      Item.countDocuments({ status: 'returned' }),
      Item.countDocuments({ status: 'rejected' }),
      Item.countDocuments({ type: 'lost' }),
      Item.countDocuments({ type: 'found' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', isSuspended: false }),
      User.countDocuments({ role: 'student', isSuspended: true }),
      Claim.countDocuments(),
      Claim.countDocuments({ status: 'pending' }),
      Claim.countDocuments({ status: 'approved' }),
      Claim.countDocuments({ status: 'rejected' }),
      Match.countDocuments(),
      Match.countDocuments({ notificationSent: false }),
      MonthlyReward.countDocuments({ status: 'pending_review' }),
      MonthlyReward.countDocuments({ status: 'issued' }),
      Contribution.countDocuments(),
      Contribution.aggregate([{ $group: { _id: null, total: { $sum: '$points' } } }])
    ]);

    // Recent 5 items and 5 claims
    const [recentItems, recentClaims] = await Promise.all([
      Item.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(5)
        .populate('reportedBy', 'name section').lean(),
      Claim.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(5)
        .populate('item', 'title type location')
        .populate('claimant', 'name section').lean()
    ]);

    res.json({
      success: true,
      stats: {
        totalItems, pendingItems, approvedItems, returnedItems, rejectedItems,
        totalLostItems, totalFoundItems,
        totalUsers, activeUsers, suspendedUsers,
        totalClaims, pendingClaims, approvedClaims, rejectedClaims,
        totalMatches, unsentMatches,
        pendingRewards, issuedRewards,
        totalContributions,
        totalPointsAwarded: totalPointsArr[0]?.total || 0
      },
      recentItems,
      recentClaims
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/items', adminGetItems);

router.patch('/items/:id/status', async (req, res, next) => {
  const before = await require('../models/Item').findById(req.params.id).lean();
  await adminUpdateStatus(req, res);
  // audit after response — fire and forget
  if (before && req.body.status) {
    audit(req, `ITEM_${req.body.status.toUpperCase()}`, 'Item', req.params.id,
      `Changed item "${before.title}" from ${before.status} → ${req.body.status}. Note: ${req.body.adminNote || '—'}`,
      { status: before.status }, { status: req.body.status, adminNote: req.body.adminNote });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MATCHES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/matches', adminGetMatches);

// ─────────────────────────────────────────────────────────────────────────────
// CLAIMS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/claims', adminGetClaims);

router.patch('/claims/:id', async (req, res) => {
  const Claim = require('../models/Claim');
  const before = await Claim.findById(req.params.id).lean();
  await adminUpdateClaim(req, res);
  if (before && req.body.status) {
    audit(req, `CLAIM_${req.body.status.toUpperCase()}`, 'Claim', req.params.id,
      `Claim for item ${before.item} changed to ${req.body.status}. Reason: ${req.body.adminNote || '—'}`,
      { status: before.status }, { status: req.body.status });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRIBUTIONS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/contributions', adminGetContributions);

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const filter = { role: 'student' };
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }, { section: re }];
    }
    if (status === 'active')    filter.isSuspended = false;
    if (status === 'suspended') filter.isSuspended = true;

    const skip  = (parseInt(page,10)-1) * parseInt(limit,10);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .sort({ contributionPoints: -1, createdAt: -1 })
      .skip(skip).limit(parseInt(limit,10));
    res.json({ success: true, total, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const Item         = require('../models/Item');
    const Claim        = require('../models/Claim');
    const Contribution = require('../models/Contribution');
    const Activity     = require('../models/Activity');

    const [items, claims, contributions, activities] = await Promise.all([
      Item.find({ reportedBy: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
      Claim.find({ claimant: user._id }).populate('item','title type location').sort({ createdAt: -1 }).limit(20).lean(),
      Contribution.find({ user: user._id }).populate('item','title type').sort({ createdAt: -1 }).limit(20).lean(),
      Activity.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    res.json({ success: true, user, items, claims, contributions, activities });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/users/:id/suspend', async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    const { isSuspended } = req.body;
    const before = await User.findById(req.params.id).select('-password').lean();
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isSuspended: Boolean(isSuspended) },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    audit(req, isSuspended ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED', 'User', user._id,
      `User ${user.name} (${user.email}) ${isSuspended ? 'suspended' : 'reactivated'}`,
      { isSuspended: before.isSuspended }, { isSuspended: Boolean(isSuspended) });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 30, action } = req.query;
    const filter = {};
    if (action && action !== 'all') filter.action = action;

    const skip  = (parseInt(page,10)-1) * parseInt(limit,10);
    const total = await AuditLog.countDocuments(filter);
    const logs  = await AuditLog.find(filter)
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip).limit(parseInt(limit,10));

    res.json({ success: true, total, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  try {
    const Item         = require('../models/Item');
    const Claim        = require('../models/Claim');
    const Contribution = require('../models/Contribution');

    // Last 7 months of report trends
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 6);
    sevenMonthsAgo.setDate(1);
    sevenMonthsAgo.setHours(0,0,0,0);

    const [reportTrend, claimTrend, categoryBreakdown, locationBreakdown, returnRate] = await Promise.all([
      // Monthly reports: lost vs found
      Item.aggregate([
        { $match: { createdAt: { $gte: sevenMonthsAgo } } },
        { $group: {
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' }, type: '$type' },
          count: { $sum: 1 }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // Monthly claims
      Claim.aggregate([
        { $match: { createdAt: { $gte: sevenMonthsAgo } } },
        { $group: {
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' }, status: '$status' },
          count: { $sum: 1 }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // Category breakdown
      Item.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Top locations
      Item.aggregate([
        { $group: { _id: '$location', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]),

      // Return rate (returned / total found)
      Promise.all([
        Item.countDocuments({ type: 'found' }),
        Item.countDocuments({ status: 'returned' })
      ])
    ]);

    // Contribution trend (monthly points awarded)
    const contribTrend = await Contribution.aggregate([
      { $match: { createdAt: { $gte: sevenMonthsAgo } } },
      { $group: {
        _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
        points: { $sum: '$points' },
        count:  { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      analytics: {
        reportTrend,
        claimTrend,
        categoryBreakdown,
        locationBreakdown,
        returnRate: { total: returnRate[0], returned: returnRate[1] },
        contribTrend
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY REWARDS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/rewards',                adminGetAllRewards);
router.post('/rewards/trigger',       adminTriggerMonth);

router.patch('/rewards/:id/confirm', async (req, res) => {
  await adminConfirmWinner(req, res);
  audit(req, 'REWARD_CONFIRMED', 'MonthlyReward', req.params.id,
    `Monthly winner confirmed. Note: ${req.body.adminNote || '—'}`);
});

router.patch('/rewards/:id/issue', async (req, res) => {
  await adminIssueCoupon(req, res);
  audit(req, 'REWARD_ISSUED', 'MonthlyReward', req.params.id,
    `Food coupon issued. Value: ₹${req.body.rewardValue || 200}`);
});

router.patch('/rewards/:id/redeem', async (req, res) => {
  await adminMarkRedeemed(req, res);
  audit(req, 'REWARD_REDEEMED', 'MonthlyReward', req.params.id, 'Coupon marked as redeemed');
});

router.patch('/rewards/:id/expire', async (req, res) => {
  await adminMarkExpired(req, res);
  audit(req, 'REWARD_EXPIRED', 'MonthlyReward', req.params.id, 'Coupon marked as expired');
});

module.exports = router;
