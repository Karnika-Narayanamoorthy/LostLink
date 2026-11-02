'use strict';

const mongoose      = require('mongoose');
const MonthlyReward = require('../models/MonthlyReward');
const Contribution  = require('../models/Contribution');
const User          = require('../models/User');
const activityService  = require('../utils/activityService');
const notifService     = require('../utils/notificationService');
const { calculateMonthlyLeaderboard, currentMonthIST, monthBoundsUTC } = require('../utils/monthlyScheduler');

const safeId = id => mongoose.Types.ObjectId.isValid(id);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC / STUDENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/rewards/leaderboard   – current month live standings
exports.getCurrentLeaderboard = async (req, res) => {
  try {
    const { month, year } = currentMonthIST();
    const leaderboard     = await calculateMonthlyLeaderboard(month, year);

    // Countdown to end of month (in seconds)
    const { end } = monthBoundsUTC(month, year);
    const secondsLeft = Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000));

    res.json({
      success: true,
      month, year,
      secondsLeft,
      leaderboard: leaderboard.map((u, i) => ({
        rank: i + 1,
        ...u
      }))
    });
  } catch (err) {
    console.error('getCurrentLeaderboard:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/rewards/leaderboard/:year/:month  – historical month standings
exports.getMonthLeaderboard = async (req, res) => {
  try {
    const month = parseInt(req.params.month, 10);
    const year  = parseInt(req.params.year,  10);

    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month or year' });
    }

    const leaderboard = await calculateMonthlyLeaderboard(month, year);
    res.json({
      success: true,
      month, year,
      leaderboard: leaderboard.map((u, i) => ({ rank: i + 1, ...u }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/rewards/monthly-winners  – past winners list (public, no coupon codes)
exports.getMonthlyWinners = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await MonthlyReward.countDocuments({ status: { $in: ['confirmed','issued','redeemed'] } });

    const winners = await MonthlyReward.find({ status: { $in: ['confirmed','issued','redeemed'] } })
      // Never include coupon code in public listing
      .select('-couponCode')
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    res.json({ success: true, total, winners });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/rewards/my-rewards  – logged-in user's own rewards (includes coupon if winner)
exports.getMyRewards = async (req, res) => {
  try {
    // Find all months where this user is the winner
    const rewards = await MonthlyReward.find({
      winner: req.user._id,
      status: { $in: ['confirmed', 'issued', 'redeemed', 'expired'] }
    })
      .select('+couponCode')   // allow coupon for the owner
      .sort({ year: -1, month: -1 })
      .lean();

    res.json({ success: true, rewards });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/rewards/my-rank  – current user's rank and points for this month
exports.getMyRank = async (req, res) => {
  try {
    const { month, year }   = currentMonthIST();
    const { start, end }    = monthBoundsUTC(month, year);
    const secondsLeft       = Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000));

    // All users' monthly totals for this month
    const allScores = await Contribution.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$user', monthlyPoints: { $sum: '$points' }, returns: { $sum: { $cond: [{ $eq: ['$action','ITEM_RETURNED']},1,0] } } } },
      { $sort: { monthlyPoints: -1, returns: -1 } }
    ]);

    const myEntry = allScores.find(s => s._id.toString() === req.user._id.toString());
    const rank    = myEntry ? allScores.indexOf(myEntry) + 1 : null;

    // Also fetch this user's pending rewards
    const pendingReward = await MonthlyReward.findOne({
      winner: req.user._id,
      status: 'issued'
    }).select('+couponCode').lean();

    res.json({
      success: true,
      month, year,
      secondsLeft,
      monthlyPoints:  myEntry?.monthlyPoints || 0,
      rank,
      totalParticipants: allScores.length,
      pendingReward
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/rewards/:id  – single reward (winner or admin only)
exports.getReward = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid reward ID' });

    const reward = await MonthlyReward.findById(req.params.id)
      .populate('winner',   'name section contributionLevel')
      .populate('issuedBy', 'name')
      .lean();

    if (!reward)
      return res.status(404).json({ success: false, message: 'Reward not found' });

    const isWinner = reward.winner?._id?.toString() === req.user._id.toString();
    const isAdmin  = req.user.role === 'admin';

    if (!isWinner && !isAdmin)
      return res.status(403).json({ success: false, message: 'Access denied' });

    // Coupon only for winner or admin
    if (!isWinner && !isAdmin) delete reward.couponCode;

    // Re-fetch with couponCode if authorised
    const full = await MonthlyReward.findById(req.params.id)
      .select('+couponCode')
      .populate('winner',   'name section contributionLevel')
      .populate('issuedBy', 'name')
      .lean();

    res.json({ success: true, reward: full });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/rewards  – all monthly reward records
exports.adminGetAllRewards = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;

    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await MonthlyReward.countDocuments(filter);

    const rewards = await MonthlyReward.find(filter)
      .select('+couponCode')
      .populate('winner',   'name email section')
      .populate('issuedBy', 'name')
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    res.json({ success: true, total, rewards });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/admin/rewards/:id/confirm  – admin confirms winner
exports.adminConfirmWinner = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid reward ID' });

    const { adminNote, winnerId } = req.body;  // winnerId allows admin to override tie
    const reward = await MonthlyReward.findById(req.params.id);
    if (!reward)
      return res.status(404).json({ success: false, message: 'Reward not found' });

    if (!['pending_review'].includes(reward.status))
      return res.status(400).json({ success: false, message: `Cannot confirm – current status is ${reward.status}` });

    // Allow admin to resolve a tie by picking a specific winner
    if (winnerId && safeId(winnerId)) {
      const u = await User.findById(winnerId).lean();
      if (u) {
        reward.winner        = winnerId;
        reward.winnerName    = u.name;
        reward.winnerSection = u.section || '';
      }
    }

    reward.status    = 'confirmed';
    reward.adminNote = adminNote || reward.adminNote;
    reward.hasTie    = false;
    await reward.save();

    // Record activity for the winner
    activityService.recordMonthlyWinner(reward.winner, reward.month, reward.year, reward.monthlyPoints);

    res.json({ success: true, message: 'Winner confirmed', reward });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/admin/rewards/:id/issue  – admin issues the food coupon
exports.adminIssueCoupon = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid reward ID' });

    const {
      couponCode,
      rewardTitle       = 'Monthly Finder Champion Reward',
      rewardDescription = '',
      rewardValue       = 200,
      expiryDate,
      adminNote
    } = req.body;

    if (!couponCode || !couponCode.trim())
      return res.status(400).json({ success: false, message: 'Coupon code is required' });

    const reward = await MonthlyReward.findById(req.params.id).select('+couponCode');
    if (!reward)
      return res.status(404).json({ success: false, message: 'Reward not found' });

    if (reward.status !== 'confirmed')
      return res.status(400).json({ success: false, message: `Cannot issue – current status is ${reward.status}` });

    reward.status             = 'issued';
    reward.couponCode         = couponCode.trim();
    reward.rewardTitle        = rewardTitle;
    reward.rewardDescription  = rewardDescription;
    reward.rewardValue        = rewardValue;
    reward.issuedBy           = req.user._id;
    reward.issuedAt           = new Date();
    reward.expiryDate         = expiryDate ? new Date(expiryDate) : null;
    reward.adminNote          = adminNote || '';
    reward.winnerNotified     = false;
    await reward.save();

    // Notify the winner
    try {
      await notifService.sendSystemNotification({
        recipient:   reward.winner,
        title:       `🎁 You've won a food coupon!`,
        message:     `Congratulations! You have been issued a ₹${rewardValue} food coupon as the Monthly Finder Champion for ${_monthLabel(reward.month, reward.year)}. Check your rewards page for the coupon code.`,
        relatedItem: null
      });
      reward.winnerNotified = true;
      await reward.save();
    } catch (_) { /* notification failure should not block the response */ }

    // Record activity
    activityService.recordRewardIssued(reward.winner, reward.rewardTitle, reward.rewardValue);

    res.json({ success: true, message: 'Coupon issued successfully', reward });
  } catch (err) {
    console.error('adminIssueCoupon:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/admin/rewards/:id/redeem  – admin marks coupon as redeemed
exports.adminMarkRedeemed = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid reward ID' });

    const reward = await MonthlyReward.findById(req.params.id).select('+couponCode');
    if (!reward)
      return res.status(404).json({ success: false, message: 'Reward not found' });

    if (reward.status !== 'issued')
      return res.status(400).json({ success: false, message: `Cannot mark redeemed – status is ${reward.status}` });

    reward.status     = 'redeemed';
    reward.redeemedAt = new Date();
    await reward.save();

    res.json({ success: true, message: 'Reward marked as redeemed', reward });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/admin/rewards/:id/expire
exports.adminMarkExpired = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid reward ID' });

    const reward = await MonthlyReward.findById(req.params.id);
    if (!reward)
      return res.status(404).json({ success: false, message: 'Reward not found' });

    reward.status = 'expired';
    await reward.save();

    res.json({ success: true, message: 'Reward marked as expired', reward });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin/rewards/trigger  – manually trigger monthly calculation (for testing / recovery)
exports.adminTriggerMonth = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year)
      return res.status(400).json({ success: false, message: 'month and year required' });

    const { processMonth } = require('../utils/monthlyScheduler');
    const result = await processMonth(parseInt(month,10), parseInt(year,10));
    if (!result)
      return res.json({ success: true, message: 'No eligible contributors for that month' });

    res.json({ success: true, message: 'Monthly calculation complete', reward: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Helper ────────────────────────────────────────────────────────────────────
function _monthLabel(month, year) {
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}
