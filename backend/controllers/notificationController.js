const mongoose    = require('mongoose');
const Notification = require('../models/Notification');

const safeId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── GET /api/notifications  (paginated) ───────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const filter = { recipient: req.user._id };
    const total  = await Notification.countDocuments(filter);

    const notifications = await Notification.find(filter)
      .populate('relatedItem',     'title image imageUrl location type')
      .populate('relatedLostItem', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    // Attach image URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const formatted = notifications.map(n => {
      const obj = n.toObject();
      if (obj.relatedItem && obj.relatedItem.image) {
        obj.relatedItem.imageUrl = `${baseUrl}/uploads/${obj.relatedItem.image}`;
      }
      return obj;
    });

    res.json({
      success: true,
      total,
      page:       parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      notifications: formatted
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/notifications/unread-count ───────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead:    false
    });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────────
exports.markAsRead = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });

    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PATCH /api/notifications/read-all ─────────────────────────────────────────
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /api/notifications/:id ─────────────────────────────────────────────
exports.deleteNotification = async (req, res) => {
  try {
    if (!safeId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });

    const notif = await Notification.findOneAndDelete({
      _id:       req.params.id,
      recipient: req.user._id
    });

    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
