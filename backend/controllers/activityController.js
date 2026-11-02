const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const Item     = require('../models/Item');
const Claim    = require('../models/Claim');

const safeId = id => mongoose.Types.ObjectId.isValid(id);

// ── GET /api/activities/me  (paginated, filterable) ───────────────────────────
exports.getMyActivities = async (req, res) => {
  try {
    const {
      page   = 1,
      limit  = 20,
      type,          // activity type filter
      search,        // search in title/description
      dateFrom,
      dateTo,
      sort   = 'newest'
    } = req.query;

    const filter = { user: req.user._id };

    // Type filter
    if (type && type !== 'all') {
      // Support grouped filters for the tab UI
      const typeMap = {
        lost:       ['ITEM_REPORTED'],   // will be further filtered below
        found:      ['ITEM_REPORTED'],
        claims:     ['CLAIM_SUBMITTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED'],
        returned:   ['ITEM_RETURNED'],
        points:     ['POINTS_EARNED'],
        rewards:    ['REWARD_ISSUED', 'MONTHLY_WINNER']
      };
      if (typeMap[type]) {
        filter.type = { $in: typeMap[type] };
        // Distinguish lost vs found via meta
        if (type === 'lost')  filter['meta.itemType'] = 'lost';
        if (type === 'found') filter['meta.itemType'] = 'found';
      } else {
        filter.type = type;  // exact match (e.g. 'ITEM_REPORTED')
      }
    }

    // Date range
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo)   filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23,59,59,999));
    }

    // Search
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: re }, { description: re }, { 'meta.itemTitle': re }];
    }

    const skip     = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const sortDir  = sort === 'oldest' ? 1 : -1;
    const total    = await Activity.countDocuments(filter);

    const activities = await Activity.find(filter)
      .populate('relatedItem',         'title image type location status')
      .populate('relatedClaim',        'status adminNote')
      .populate('relatedContribution', 'points action description')
      .sort({ createdAt: sortDir })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    // Attach image URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const formatted = activities.map(a => {
      if (a.relatedItem?.image) {
        a.relatedItem.imageUrl = `${baseUrl}/uploads/${a.relatedItem.image}`;
      }
      return a;
    });

    res.json({
      success: true,
      total,
      page:       parseInt(page, 10),
      totalPages: Math.ceil(total / Math.max(parseInt(limit, 10), 1)),
      activities: formatted
    });
  } catch (err) {
    console.error('getMyActivities error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/activities/me/summary ────────────────────────────────────────────
exports.getMySummary = async (req, res) => {
  try {
    const uid = req.user._id;

    const [
      totalLostReports,
      totalFoundReports,
      totalClaimsSubmitted,
      totalReturned,
      totalPointsEarned,
      totalRewardsWon,
      recentActivities
    ] = await Promise.all([
      Activity.countDocuments({ user: uid, type: 'ITEM_REPORTED', 'meta.itemType': 'lost'  }),
      Activity.countDocuments({ user: uid, type: 'ITEM_REPORTED', 'meta.itemType': 'found' }),
      Activity.countDocuments({ user: uid, type: 'CLAIM_SUBMITTED' }),
      Activity.countDocuments({ user: uid, type: 'ITEM_RETURNED'   }),
      Activity.aggregate([
        { $match: { user: uid, type: 'POINTS_EARNED' } },
        { $group: { _id: null, total: { $sum: '$meta.points' } } }
      ]),
      Activity.countDocuments({ user: uid, type: { $in: ['REWARD_ISSUED', 'MONTHLY_WINNER'] } }),
      Activity.find({ user: uid })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    const points = totalPointsEarned[0]?.total || 0;

    res.json({
      success: true,
      summary: {
        totalLostReports,
        totalFoundReports,
        totalClaimsSubmitted,
        totalReturned,
        totalPointsEarned: points,
        totalRewardsWon,
        recentActivities
      }
    });
  } catch (err) {
    console.error('getMySummary error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/activities/me/:id  (single activity, owner-only) ─────────────────
exports.getMyActivity = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid activity ID' });

    const activity = await Activity.findOne({ _id: req.params.id, user: req.user._id })
      .populate('relatedItem',         'title image type location status')
      .populate('relatedClaim',        'status adminNote')
      .populate('relatedContribution', 'points action description')
      .lean();

    if (!activity)
      return res.status(404).json({ success: false, message: 'Activity not found' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    if (activity.relatedItem?.image) {
      activity.relatedItem.imageUrl = `${baseUrl}/uploads/${activity.relatedItem.image}`;
    }

    res.json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
