/**
 * LostLink Smart Matching Algorithm
 * Weighted similarity scoring between a found item and lost items.
 *
 * Weights:
 *   Category:    30%
 *   Title:       30%
 *   Description: 20%
 *   Location:    15%
 *   Date:         5%
 */

const HIGH_THRESHOLD     = parseInt(process.env.MATCH_HIGH_THRESHOLD     || '80', 10);
const POSSIBLE_THRESHOLD = parseInt(process.env.MATCH_POSSIBLE_THRESHOLD || '60', 10);
const LOOKBACK_DAYS      = parseInt(process.env.MATCH_LOOKBACK_DAYS      || '3',  10);

// ── Tokenise a string into lowercase words ────────────────────────────────────
function tokenise(str) {
  if (!str) return [];
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// ── Jaccard similarity between two token sets ─────────────────────────────────
function jaccardSimilarity(a, b) {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// ── Category exact match (30 pts) ─────────────────────────────────────────────
function categoryScore(catA, catB) {
  if (!catA || !catB) return 0;
  return catA.toLowerCase() === catB.toLowerCase() ? 30 : 0;
}

// ── Title similarity (30 pts) ─────────────────────────────────────────────────
function titleScore(titleA, titleB) {
  const tokA = tokenise(titleA);
  const tokB = tokenise(titleB);
  return Math.round(jaccardSimilarity(tokA, tokB) * 30);
}

// ── Description keyword similarity (20 pts) ───────────────────────────────────
function descriptionScore(descA, descB) {
  const tokA = tokenise(descA);
  const tokB = tokenise(descB);
  return Math.round(jaccardSimilarity(tokA, tokB) * 20);
}

// ── Location similarity (15 pts) ──────────────────────────────────────────────
function locationScore(locA, locB) {
  if (!locA || !locB) return 0;
  if (locA.toLowerCase() === locB.toLowerCase()) return 15;
  // Partial: any word overlap
  const tokA = tokenise(locA);
  const tokB = tokenise(locB);
  const sim = jaccardSimilarity(tokA, tokB);
  return Math.round(sim * 8); // partial credit up to 8
}

// ── Date compatibility (5 pts) ────────────────────────────────────────────────
// foundDate must be >= lostDate and within LOOKBACK_DAYS window
function dateScore(lostDate, foundDate) {
  if (!lostDate || !foundDate) return 0;
  const lost  = new Date(lostDate);
  const found = new Date(foundDate);
  const diffMs   = found - lost;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // Found before lost → impossible
  if (diffDays < -1) return 0;
  // Found within 1 day of lost → full score
  if (diffDays <= 1) return 5;
  // Found within LOOKBACK_DAYS → partial
  if (diffDays <= LOOKBACK_DAYS) return 3;
  return 0;
}

// ── Main: compute match score ──────────────────────────────────────────────────
function computeMatchScore(foundItem, lostItem) {
  const breakdown = {
    category:    categoryScore(foundItem.category, lostItem.category),
    title:       titleScore(foundItem.title, lostItem.title),
    description: descriptionScore(foundItem.description, lostItem.description),
    location:    locationScore(foundItem.location, lostItem.location),
    date:        dateScore(lostItem.incidentDate, foundItem.incidentDate)
  };

  const total = breakdown.category + breakdown.title + breakdown.description
              + breakdown.location + breakdown.date;

  const score = Math.min(100, Math.max(0, total));

  let label = null;
  if      (score >= HIGH_THRESHOLD)     label = 'High';
  else if (score >= POSSIBLE_THRESHOLD) label = 'Possible';

  return { score, label, breakdown };
}

// ── Eligibility: is this lost item still within the lookback window? ───────────
function isEligibleLostItem(lostItem, foundDate) {
  if (!['pending', 'approved'].includes(lostItem.status)) return false;
  const lost  = new Date(lostItem.incidentDate || lostItem.createdAt);
  const found = new Date(foundDate);
  const diffDays = (found - lost) / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays <= LOOKBACK_DAYS;
}

module.exports = { computeMatchScore, isEligibleLostItem, HIGH_THRESHOLD, POSSIBLE_THRESHOLD, LOOKBACK_DAYS };
