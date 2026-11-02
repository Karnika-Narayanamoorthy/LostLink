const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification
} = require('../controllers/notificationController');

router.get('/',             protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.patch('/read-all',   protect, markAllAsRead);
router.patch('/:id/read',   protect, markAsRead);
router.delete('/:id',       protect, deleteNotification);

module.exports = router;
