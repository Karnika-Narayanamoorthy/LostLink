const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getCurrentLeaderboard,
  getMonthLeaderboard,
  getMonthlyWinners,
  getMyRewards,
  getMyRank,
  getReward
} = require('../controllers/rewardController');

// ── Public (no auth needed) ───────────────────────────────────────────────────
router.get('/monthly-winners',           getMonthlyWinners);
router.get('/leaderboard',               getCurrentLeaderboard);
router.get('/leaderboard/:year/:month',  getMonthLeaderboard);

// ── Authenticated students ────────────────────────────────────────────────────
router.get('/my-rewards',  protect, getMyRewards);
router.get('/my-rank',     protect, getMyRank);
router.get('/:id',         protect, getReward);

module.exports = router;
