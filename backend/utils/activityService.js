/**
 * Activity Service
 * Single entry-point for recording every user activity.
 * Called from itemController, claimController and contributionService.
 * Failures are logged but never bubble up to crash the calling flow.
 */

const Activity = require('../models/Activity');

// ── Generic recorder ──────────────────────────────────────────────────────────
async function record(data) {
  try {
    await Activity.create(data);
  } catch (err) {
    // Activity logging must never break the main request
    console.error('[ActivityService] Failed to record activity:', err.message);
  }
}

// ── Item reported (lost or found) ─────────────────────────────────────────────
exports.recordItemReported = (userId, item) =>
  record({
    user:        userId,
    type:        'ITEM_REPORTED',
    title:       `Reported a ${item.type} item: ${item.title}`,
    description: `You submitted a ${item.type} report for "${item.title}" at ${item.location}.`,
    relatedItem: item._id,
    meta: {
      itemTitle:    item.title,
      itemType:     item.type,
      itemLocation: item.location,
      itemStatus:   'pending'
    }
  });

// ── Item approved by admin ────────────────────────────────────────────────────
exports.recordItemApproved = (userId, item) =>
  record({
    user:        userId,
    type:        'ITEM_APPROVED',
    title:       `Your ${item.type} report was approved`,
    description: `Admin approved your report for "${item.title}". It is now visible on campus.`,
    relatedItem: item._id,
    meta: {
      itemTitle:    item.title,
      itemType:     item.type,
      itemLocation: item.location,
      itemStatus:   'approved'
    }
  });

// ── Item rejected by admin ────────────────────────────────────────────────────
exports.recordItemRejected = (userId, item, reason) =>
  record({
    user:        userId,
    type:        'ITEM_REJECTED',
    title:       `Your ${item.type} report was not approved`,
    description: `Admin did not approve your report for "${item.title}".${reason ? ' Reason: ' + reason : ''}`,
    relatedItem: item._id,
    meta: {
      itemTitle:  item.title,
      itemType:   item.type,
      itemStatus: 'rejected',
      adminNote:  reason || ''
    }
  });

// ── Item returned ─────────────────────────────────────────────────────────────
exports.recordItemReturned = (userId, item) =>
  record({
    user:        userId,
    type:        'ITEM_RETURNED',
    title:       `"${item.title}" successfully returned`,
    description: `The item you found, "${item.title}", has been confirmed as returned to its rightful owner.`,
    relatedItem: item._id,
    meta: {
      itemTitle:    item.title,
      itemType:     item.type,
      itemLocation: item.location,
      itemStatus:   'returned'
    }
  });

// ── Claim submitted ───────────────────────────────────────────────────────────
exports.recordClaimSubmitted = (userId, item, claimId) =>
  record({
    user:         userId,
    type:         'CLAIM_SUBMITTED',
    title:        `You submitted a claim for "${item.title}"`,
    description:  `Your ownership claim for "${item.title}" at ${item.location} has been submitted for admin review.`,
    relatedItem:  item._id,
    relatedClaim: claimId,
    meta: {
      itemTitle:    item.title,
      itemLocation: item.location,
      claimStatus:  'pending'
    }
  });

// ── Claim approved ────────────────────────────────────────────────────────────
exports.recordClaimApproved = (userId, item, claimId) =>
  record({
    user:         userId,
    type:         'CLAIM_APPROVED',
    title:        `Your claim for "${item.title}" was approved`,
    description:  `Admin approved your claim. Please collect "${item.title}" from the Lost & Found desk.`,
    relatedItem:  item._id,
    relatedClaim: claimId,
    meta: {
      itemTitle:   item.title,
      claimStatus: 'approved'
    }
  });

// ── Claim rejected ────────────────────────────────────────────────────────────
exports.recordClaimRejected = (userId, item, claimId, reason) =>
  record({
    user:         userId,
    type:         'CLAIM_REJECTED',
    title:        `Your claim for "${item.title}" was not approved`,
    description:  `Admin did not approve your claim for "${item.title}".${reason ? ' Reason: ' + reason : ''}`,
    relatedItem:  item._id,
    relatedClaim: claimId,
    meta: {
      itemTitle:   item.title,
      claimStatus: 'rejected',
      adminNote:   reason || ''
    }
  });

// ── Points earned ─────────────────────────────────────────────────────────────
exports.recordPointsEarned = (userId, item, contrib, points) =>
  record({
    user:                userId,
    type:                'POINTS_EARNED',
    title:               `+${points} contribution points earned`,
    description:         contrib.description || `You earned ${points} contribution points.`,
    relatedItem:         item._id,
    relatedContribution: contrib._id,
    meta: {
      itemTitle: item.title,
      itemType:  item.type,
      points
    }
  });

// ── Monthly winner ────────────────────────────────────────────────────────────
exports.recordMonthlyWinner = (userId, month, year, points) => {
  const monthName = new Date(year, month - 1, 1)
    .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  return record({
    user:        userId,
    type:        'MONTHLY_WINNER',
    title:       `🏆 Monthly Finder Champion – ${monthName}`,
    description: `Congratulations! You were selected as the LostLink Monthly Finder Champion for ${monthName} with ${points} points.`,
    meta: { points }
  });
};

// ── Reward issued ─────────────────────────────────────────────────────────────
exports.recordRewardIssued = (userId, rewardTitle, rewardValue) =>
  record({
    user:        userId,
    type:        'REWARD_ISSUED',
    title:       `🎁 Reward issued: ${rewardTitle}`,
    description: `A ₹${rewardValue} food coupon reward has been issued to your account.`,
    meta: { points: rewardValue }
  });
