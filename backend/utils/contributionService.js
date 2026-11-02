/**
 * Contribution / Reward point service.
 * Safe for standalone MongoDB (no transactions).
 * Duplicate prevention relies on the unique index on (user, item, action).
 */

const User         = require('../models/User');
const Contribution = require('../models/Contribution');
const activityService = require('./activityService');

const POINTS_REPORT_APPROVED = parseInt(process.env.POINTS_REPORT_APPROVED || '5',  10);
const POINTS_ITEM_RETURNED   = parseInt(process.env.POINTS_ITEM_RETURNED   || '15', 10);

// ── Award points for admin-approving a found report ───────────────────────────
exports.awardApprovalPoints = async (userId, itemId) => {
  return _award({
    userId,
    itemId,
    action:      'REPORT_APPROVED',
    points:      POINTS_REPORT_APPROVED,
    description: `Found-item report approved by admin (+${POINTS_REPORT_APPROVED} pts)`,
    statField:   'verifiedFoundReports'
  });
};

// ── Award points when item is confirmed returned ──────────────────────────────
exports.awardReturnPoints = async (userId, itemId) => {
  return _award({
    userId,
    itemId,
    action:      'ITEM_RETURNED',
    points:      POINTS_ITEM_RETURNED,
    description: `Item successfully returned to owner (+${POINTS_ITEM_RETURNED} pts)`,
    statField:   'successfullyReturnedItems'
  });
};

// ── Core award (no transactions – safe for standalone MongoDB) ────────────────
async function _award({ userId, itemId, action, points, description, statField }) {
  try {
    // Step 1: Insert the contribution record.
    // The unique index on (user, item, action) will throw E11000 on duplicates.
    const contrib = await Contribution.create({
      user:        userId,
      item:        itemId,
      action,
      points,
      description
    });

    // Step 2: Atomically increment counters on User.
    // $inc is atomic in MongoDB even without transactions.
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { contributionPoints: points, [statField]: 1 } },
      { new: true }
    );

    if (!user) throw new Error('User not found while awarding points');

    // Step 3: Recalculate and persist the contribution level.
    user.recalculateLevel();
    await user.save();

    // Step 4: Record activity (non-blocking)
    const Item = require('../models/Item');
    const item = await Item.findById(itemId).lean();
    if (item) {
      activityService.recordPointsEarned(userId, item, contrib, points);
    }

    return { awarded: true, contrib, user };
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key → already awarded, silently skip
      return { awarded: false, reason: 'Already awarded' };
    }
    throw err;
  }
}
