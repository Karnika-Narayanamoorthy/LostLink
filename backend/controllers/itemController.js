const mongoose = require('mongoose');
const Item   = require('../models/Item');
const Match  = require('../models/Match');
const User   = require('../models/User');
const Claim  = require('../models/Claim');
const { computeMatchScore, isEligibleLostItem } = require('../utils/matching');
const { sendMatchNotification, sendItemApprovedNotification, sendItemRejectedNotification, sendItemReturnedNotification } = require('../utils/notificationService');
const { awardApprovalPoints, awardReturnPoints } = require('../utils/contributionService');
const activityService = require('../utils/activityService');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const safeId = (id) => mongoose.Types.ObjectId.isValid(id);

function buildImageUrl(req, filename) {
  if (!filename) return '';
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/items  (public – paginated list)
// ─────────────────────────────────────────────────────────────────────────────
exports.getItems = async (req, res) => {
  try {
    const { type, category, location, status, page = 1, limit = 12, search } = req.query;

    const filter = {};
    if (type     && type     !== 'all') filter.type     = type;
    if (category && category !== 'all') filter.category = category;
    if (location && location !== 'all') filter.location = location;

    // Public only sees approved items; admin sees everything
    if (!req.user || req.user.role !== 'admin') {
      filter.status = 'approved';
    } else if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: re }, { description: re }, { location: re }];
    }

    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .populate('reportedBy', 'name section')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      total,
      page:       parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
      items: items.map(i => formatItem(i, req))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/items/:id  (public)
// ─────────────────────────────────────────────────────────────────────────────
exports.getItem = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid item ID' });

    const item = await Item.findById(req.params.id)
      .populate('reportedBy', 'name section profileImage contributionLevel contributionBadge');

    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    // Non-admin can only see approved items unless it is their own
    const isOwner = req.user && item.reportedBy._id.toString() === req.user._id.toString();
    const isAdmin = req.user && req.user.role === 'admin';
    if (item.status !== 'approved' && !isOwner && !isAdmin) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, item: formatItem(item, req, isOwner || isAdmin) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/items  (auth required)
// ─────────────────────────────────────────────────────────────────────────────
exports.createItem = async (req, res) => {
  try {
    const { title, category, description, location, type, incidentDate, verificationCharacteristic } = req.body;

    const imageFilename = req.file ? req.file.filename : '';

    const item = await Item.create({
      title:                    title.trim(),
      category:                 category.toLowerCase(),
      description:              description || '',
      location:                 location.trim(),
      type,
      incidentDate:             incidentDate ? new Date(incidentDate) : new Date(),
      verificationCharacteristic: type === 'found' ? (verificationCharacteristic || '').trim() : '',
      image:                    imageFilename,
      reportedBy:               req.user._id,
      status:                   'pending'
    });

    // Increment total found reports counter immediately (the +5 pts come after admin approval)
    if (type === 'found') {
      await User.findByIdAndUpdate(req.user._id, { $inc: { totalFoundReports: 1 } });
    }

    // Record activity (non-blocking)
    activityService.recordItemReported(req.user._id, item);

    res.status(201).json({
      success: true,
      message: 'Report submitted. It will appear once approved by an admin.',
      item:    formatItem(item, req, true)
    });
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/items/mine  (auth required)
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyItems = async (req, res) => {
  try {
    const items = await Item.find({ reportedBy: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ success: true, items: items.map(i => formatItem(i, req, true)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/items/:id  (owner or admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteItem = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid item ID' });

    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    const isOwner = item.reportedBy.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    await item.deleteOne();
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: GET /api/admin/items  (all items with full details)
// ─────────────────────────────────────────────────────────────────────────────
exports.adminGetItems = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (type   && type   !== 'all') filter.type   = type;

    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .populate('reportedBy', 'name email section')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      total,
      page:       parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
      items: items.map(i => formatItem(i, req, true))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: PATCH /api/admin/items/:id/status
// ─────────────────────────────────────────────────────────────────────────────
exports.adminUpdateStatus = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid item ID' });

    const { status, adminNote } = req.body;
    const allowedStatuses = ['approved', 'rejected', 'returned', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const item = await Item.findById(req.params.id).populate('reportedBy', 'name email');
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    const previousStatus = item.status;
    item.status    = status;
    item.adminNote = adminNote || '';

    if (status === 'approved')  item.approvedAt  = new Date();
    if (status === 'rejected')  item.rejectedAt  = new Date();
    if (status === 'returned')  item.returnedAt  = new Date();

    await item.save();

    // ── Notifications & reward logic ─────────────────────────────────────────
    if (previousStatus !== status) {
      const reporterId = item.reportedBy._id;

      if (status === 'approved') {
        // Notify reporter
        await sendItemApprovedNotification({ recipient: reporterId, item });
        activityService.recordItemApproved(reporterId, item);

        // Award +5 points if it is a found item (once only)
        if (item.type === 'found' && !item.rewardApprovalGranted) {
          await awardApprovalPoints(reporterId, item._id);
          item.rewardApprovalGranted = true;
          await item.save();
        }

        // Run smart matching AFTER approval
        if (item.type === 'found') {
          await runMatchingForFoundItem(item);
        }

      } else if (status === 'rejected') {
        await sendItemRejectedNotification({ recipient: reporterId, item, reason: adminNote });
        activityService.recordItemRejected(reporterId, item, adminNote);

      } else if (status === 'returned') {
        await sendItemReturnedNotification({ recipient: reporterId, item });
        activityService.recordItemReturned(reporterId, item);

        // Award +15 points for confirmed return (once only)
        if (item.type === 'found' && !item.rewardReturnGranted) {
          await awardReturnPoints(reporterId, item._id);
          item.rewardReturnGranted = true;
          await item.save();
        }
      }
    }

    res.json({ success: true, message: `Item status updated to ${status}`, item: formatItem(item, req, true) });
  } catch (err) {
    console.error('Admin update status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SMART MATCHING  (called internally after a found item is approved)
// ─────────────────────────────────────────────────────────────────────────────
async function runMatchingForFoundItem(foundItem) {
  try {
    // Find eligible lost items (status pending or approved) within lookback window
    const cutoff = new Date(foundItem.incidentDate);
    cutoff.setDate(cutoff.getDate() - (parseInt(process.env.MATCH_LOOKBACK_DAYS || '3', 10) + 1));

    const lostItems = await Item.find({
      type:         'lost',
      status:       { $in: ['pending', 'approved'] },
      incidentDate: { $gte: cutoff }
    }).populate('reportedBy', 'name');

    for (const lostItem of lostItems) {
      if (!isEligibleLostItem(lostItem, foundItem.incidentDate)) continue;

      const { score, label, breakdown } = computeMatchScore(foundItem, lostItem);
      if (!label) continue; // below threshold

      // Upsert the match record
      const match = await Match.findOneAndUpdate(
        { foundItem: foundItem._id, lostItem: lostItem._id },
        {
          score,
          label,
          scoreBreakdown: breakdown,
          foundItem: foundItem._id,
          lostItem:  lostItem._id
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Send notification only once
      if (!match.notificationSent) {
        await sendMatchNotification({
          recipient: lostItem.reportedBy._id,
          foundItem,
          lostItem,
          score,
          label
        });

        match.notificationSent   = true;
        match.notificationSentAt = new Date();
        await match.save();
      }
    }
  } catch (err) {
    console.error('Matching error:', err);
  }
}

// Export for admin usage
exports.runMatchingForFoundItem = runMatchingForFoundItem;

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: GET /api/admin/matches
// ─────────────────────────────────────────────────────────────────────────────
exports.adminGetMatches = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Match.countDocuments();

    const matches = await Match.find()
      .populate({ path: 'foundItem', populate: { path: 'reportedBy', select: 'name' } })
      .populate({ path: 'lostItem',  populate: { path: 'reportedBy', select: 'name' } })
      .sort({ score: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({ success: true, total, matches });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CLAIMS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/items/:id/claims
exports.submitClaim = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid item ID' });

    const item = await Item.findById(req.params.id)
      .select('+verificationCharacteristic')
      .populate('reportedBy', 'name _id');

    if (!item || item.status !== 'approved' || item.type !== 'found') {
      return res.status(404).json({ success: false, message: 'Item not available for claiming' });
    }

    if (item.reportedBy._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot claim your own report' });
    }

    const { verificationAnswer, additionalInfo } = req.body;
    if (!verificationAnswer) {
      return res.status(400).json({ success: false, message: 'Verification answer required' });
    }

    const existing = await Claim.findOne({ item: item._id, claimant: req.user._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already submitted a claim for this item' });
    }

    const claim = await Claim.create({
      item:               item._id,
      claimant:           req.user._id,
      verificationAnswer: verificationAnswer.trim(),
      additionalInfo:     additionalInfo || ''
    });

    // Notify the finder
    const { sendClaimSubmittedNotification } = require('../utils/notificationService');
    await sendClaimSubmittedNotification({
      recipient: item.reportedBy._id,
      item,
      claimant:  req.user
    });

    // Record activity for the claimant
    activityService.recordClaimSubmitted(req.user._id, item, claim._id);

    res.status(201).json({ success: true, message: 'Claim submitted. Admin will review it.', claimId: claim._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ADMIN: GET /api/admin/claims
exports.adminGetClaims = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;

    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Claim.countDocuments(filter);

    const claims = await Claim.find(filter)
      .populate('item',     'title type location image status')
      .populate('claimant', 'name email section')
      .select('+verificationAnswer')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({ success: true, total, claims });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ADMIN: PATCH /api/admin/claims/:id
exports.adminUpdateClaim = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid claim ID' });

    const { status, adminNote } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const claim = await Claim.findById(req.params.id)
      .populate('item',     'title type location _id')
      .populate('claimant', 'name _id');

    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    claim.status     = status;
    claim.adminNote  = adminNote || '';
    claim.reviewedAt = new Date();
    await claim.save();

    const { sendClaimApprovedNotification, sendClaimRejectedNotification } = require('../utils/notificationService');

    if (status === 'approved') {
      await sendClaimApprovedNotification({ recipient: claim.claimant._id, item: claim.item });
      activityService.recordClaimApproved(claim.claimant._id, claim.item, claim._id);
    } else {
      await sendClaimRejectedNotification({ recipient: claim.claimant._id, item: claim.item, reason: adminNote });
      activityService.recordClaimRejected(claim.claimant._id, claim.item, claim._id, adminNote);
    }

    res.json({ success: true, message: `Claim ${status}`, claim });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function formatItem(item, req, showSensitive = false) {
  const obj = item.toObject ? item.toObject() : { ...item };

  // Build absolute image URL
  if (obj.image) {
    obj.imageUrl = buildImageUrl(req, obj.image);
  } else {
    obj.imageUrl = '';
  }

  // Never expose verification characteristic in public responses
  if (!showSensitive) {
    delete obj.verificationCharacteristic;
  }

  return obj;
}
