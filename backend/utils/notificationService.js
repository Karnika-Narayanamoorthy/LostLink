/**
 * Central notification service.
 * All notification creation goes through here so real-time delivery
 * and persistence are always handled together.
 */

const Notification = require('../models/Notification');

let _io = null; // Socket.IO instance – injected at server startup

exports.setIO = (io) => { _io = io; };

// ── Emit to a user's private room ─────────────────────────────────────────────
function emitToUser(userId, event, payload) {
  if (_io) {
    _io.to(`user:${userId}`).emit(event, payload);
  }
}

// ── Core: create + persist + emit ─────────────────────────────────────────────
async function createNotification(data) {
  try {
    const notif = await Notification.create(data);

    // Populate for real-time payload
    await notif.populate([
      { path: 'relatedItem',     select: 'title image location type' },
      { path: 'relatedLostItem', select: 'title' }
    ]);

    emitToUser(data.recipient.toString(), 'notification:new', notif);
    return notif;
  } catch (err) {
    // Duplicate key = notification already exists → silently ignore
    if (err.code === 11000) return null;
    throw err;
  }
}

// ── Item match notification (sent after admin approval of found item) ──────────
exports.sendMatchNotification = async ({ recipient, foundItem, lostItem, score, label }) => {
  return createNotification({
    recipient,
    type: 'ITEM_MATCH',
    title: label === 'High' ? 'High-confidence match found!' : 'Possible match found!',
    message: `Good news! A found item matching your lost "${lostItem.title}" has been reported on campus. Check the details and submit a claim if it is yours.`,
    relatedItem:     foundItem._id,
    relatedLostItem: lostItem._id,
    matchScore:      score,
    matchLabel:      label
  });
};

// ── Item status updates ────────────────────────────────────────────────────────
exports.sendItemApprovedNotification = async ({ recipient, item }) => {
  return createNotification({
    recipient,
    type: 'ITEM_UPDATE',
    title: 'Your report has been approved',
    message: `Your ${item.type} item report "${item.title}" has been approved by the admin and is now visible on campus.`,
    relatedItem: item._id
  });
};

exports.sendItemRejectedNotification = async ({ recipient, item, reason }) => {
  return createNotification({
    recipient,
    type: 'ITEM_UPDATE',
    title: 'Your report was not approved',
    message: `Your ${item.type} item report "${item.title}" was not approved.${reason ? ' Reason: ' + reason : ''}`,
    relatedItem: item._id
  });
};

exports.sendItemReturnedNotification = async ({ recipient, item }) => {
  return createNotification({
    recipient,
    type: 'ITEM_UPDATE',
    title: 'Item successfully returned!',
    message: `Great news! Your found item "${item.title}" has been confirmed as returned to its rightful owner.`,
    relatedItem: item._id
  });
};

// ── Claim notifications ────────────────────────────────────────────────────────
exports.sendClaimSubmittedNotification = async ({ recipient, item, claimant }) => {
  return createNotification({
    recipient,
    sender: claimant._id,
    type: 'CLAIM_UPDATE',
    title: 'New claim on your found item',
    message: `${claimant.name} has submitted a claim for your found item "${item.title}". Review it in your dashboard.`,
    relatedItem: item._id
  });
};

exports.sendClaimApprovedNotification = async ({ recipient, item }) => {
  return createNotification({
    recipient,
    type: 'CLAIM_UPDATE',
    title: 'Your claim has been approved!',
    message: `Your claim for "${item.title}" has been approved. Please proceed to the Lost & Found desk to collect your item.`,
    relatedItem: item._id
  });
};

exports.sendClaimRejectedNotification = async ({ recipient, item, reason }) => {
  return createNotification({
    recipient,
    type: 'CLAIM_UPDATE',
    title: 'Your claim was not approved',
    message: `Your claim for "${item.title}" was not approved.${reason ? ' Reason: ' + reason : ''}`,
    relatedItem: item._id
  });
};

// ── Generic system notification (used by reward issuance) ─────────────────────
exports.sendSystemNotification = async ({ recipient, title, message, relatedItem = null }) => {
  return createNotification({
    recipient,
    type:        'SYSTEM',
    title,
    message,
    relatedItem
  });
};
