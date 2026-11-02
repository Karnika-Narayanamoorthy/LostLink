/**
 * Monthly Champion Scheduler
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses Asia/Kolkata timezone for month boundaries.
 * Duplicate-safe: MonthlyReward has a unique index on (month, year).
 * Node.js setTimeout max is ~24.8 days (2^31-1 ms). For long waits we chunk
 * the delay into ≤24-day steps to avoid the 32-bit overflow.
 */

'use strict';

const Contribution  = require('../models/Contribution');
const MonthlyReward = require('../models/MonthlyReward');
const User          = require('../models/User');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;           // +05:30
const MAX_TIMEOUT   = 24 * 24 * 60 * 60 * 1000;        // 24 days in ms

// ── IST helpers ───────────────────────────────────────────────────────────────
function nowIST()   { return new Date(Date.now() + IST_OFFSET_MS); }

function prevMonthIST() {
  const n = nowIST();
  let month = n.getUTCMonth();    // 0-based current → subtract 1 = previous
  let year  = n.getUTCFullYear();
  if (month === 0) { month = 12; year -= 1; }
  return { month, year };
}

function currentMonthIST() {
  const n = nowIST();
  return { month: n.getUTCMonth() + 1, year: n.getUTCFullYear() };
}

// UTC bounds for IST calendar month
function monthBoundsUTC(month, year) {
  const startIST = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - IST_OFFSET_MS);
  const nm = month === 12 ? 1 : month + 1;
  const ny = month === 12 ? year + 1 : year;
  const endIST = new Date(Date.UTC(ny, nm - 1, 1, 0, 0, 0) - IST_OFFSET_MS - 1);
  return { start: startIST, end: endIST };
}

// ── Monthly leaderboard aggregate ─────────────────────────────────────────────
async function calculateMonthlyLeaderboard(month, year) {
  const { start, end } = monthBoundsUTC(month, year);

  const agg = await Contribution.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id:             '$user',
        monthlyPoints:   { $sum: '$points' },
        returns:         { $sum: { $cond: [{ $eq: ['$action', 'ITEM_RETURNED']   }, 1, 0] } },
        approvedReports: { $sum: { $cond: [{ $eq: ['$action', 'REPORT_APPROVED'] }, 1, 0] } },
        firstAchieved:   { $min: '$createdAt' }
      }
    },
    { $sort: { monthlyPoints: -1, returns: -1, approvedReports: -1, firstAchieved: 1 } },
    { $limit: 10 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $match: { 'u.isSuspended': false } },
    {
      $project: {
        _id: 0, userId: '$_id',
        name: '$u.name', section: '$u.section',
        monthlyPoints: 1, returns: 1, approvedReports: 1, firstAchieved: 1
      }
    }
  ]);

  return agg;
}

// ── Process a single month (idempotent) ───────────────────────────────────────
async function processMonth(month, year) {
  const existing = await MonthlyReward.findOne({ month, year });
  if (existing) {
    console.log(`[Scheduler] ${month}/${year} already processed (${existing.status})`);
    return existing;
  }

  console.log(`[Scheduler] Calculating winner for ${month}/${year}…`);
  const lb = await calculateMonthlyLeaderboard(month, year);

  if (!lb.length) {
    console.log(`[Scheduler] No eligible contributors for ${month}/${year}`);
    return null;
  }

  const top      = lb[0];
  const runner   = lb[1];
  const hasTie   = runner &&
    runner.monthlyPoints   === top.monthlyPoints &&
    runner.returns         === top.returns &&
    runner.approvedReports === top.approvedReports;

  const reward = await MonthlyReward.create({
    month, year,
    winner:            top.userId,
    winnerName:        top.name,
    winnerSection:     top.section || '',
    monthlyPoints:     top.monthlyPoints,
    successfulReturns: top.returns,
    approvedReports:   top.approvedReports,
    status:            'pending_review',
    hasTie,
    tieDetails: hasTie
      ? `Tie between ${top.name} and ${runner.name} (${top.monthlyPoints} pts). Admin review needed.`
      : '',
    topContributors: lb.map(u => ({
      userId: u.userId, name: u.name, section: u.section || '',
      monthlyPoints: u.monthlyPoints, returns: u.returns, approvedReports: u.approvedReports
    }))
  });

  console.log(`[Scheduler] Winner for ${month}/${year}: ${top.name} (${top.monthlyPoints} pts)${hasTie ? ' ⚠ TIE' : ''}`);
  return reward;
}

// ── Safe setTimeout that handles delays > 24.8 days ──────────────────────────
function safeTimeout(fn, delayMs) {
  if (delayMs <= MAX_TIMEOUT) {
    setTimeout(fn, delayMs);
    return;
  }
  // Chunk: wait MAX_TIMEOUT, then recurse with remaining time
  setTimeout(() => safeTimeout(fn, delayMs - MAX_TIMEOUT), MAX_TIMEOUT);
}

// ── Schedule run at IST 00:05 on the 1st of next month ───────────────────────
function scheduleNextRun() {
  const n      = nowIST();
  const ny     = n.getUTCMonth() === 11 ? n.getUTCFullYear() + 1 : n.getUTCFullYear();
  const nm     = n.getUTCMonth() === 11 ? 0 : n.getUTCMonth() + 1;
  // 00:05 IST on 1st of next month → subtract IST offset for UTC
  const fireAt = new Date(Date.UTC(ny, nm, 1, 0, 5, 0) - IST_OFFSET_MS);
  const delay  = fireAt.getTime() - Date.now();
  const hours  = Math.round(delay / 3600000);

  console.log(`[Scheduler] Next monthly run in ~${hours}h (${fireAt.toISOString()})`);

  safeTimeout(async () => {
    const prev = prevMonthIST();
    try { await processMonth(prev.month, prev.year); } catch (e) { console.error('[Scheduler]', e.message); }
    scheduleNextRun();
  }, delay);
}

// ── Recovery: process last month if missed ────────────────────────────────────
async function recoverMissedMonths() {
  const prev = prevMonthIST();
  try {
    await processMonth(prev.month, prev.year);
  } catch (err) {
    console.error('[Scheduler] Recovery error:', err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
module.exports = {
  init: async () => {
    await recoverMissedMonths();
    scheduleNextRun();
  },
  processMonth,
  calculateMonthlyLeaderboard,
  currentMonthIST,
  prevMonthIST,
  monthBoundsUTC
};
