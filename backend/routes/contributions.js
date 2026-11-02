const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getMySummary, getMyHistory, getLeaderboard, getUserContribution
} = require('../controllers/contributionController');

router.get('/me',           protect, getMySummary);
router.get('/history',      protect, getMyHistory);
router.get('/leaderboard',           getLeaderboard);
router.get('/users/:id',             getUserContribution);

module.exports = router;
