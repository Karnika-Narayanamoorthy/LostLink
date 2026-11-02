const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getMyActivities, getMySummary, getMyActivity
} = require('../controllers/activityController');

// All activity routes are private – only the logged-in user sees their own data
router.get('/me',         protect, getMyActivities);
router.get('/me/summary', protect, getMySummary);
router.get('/me/:id',     protect, getMyActivity);

module.exports = router;
