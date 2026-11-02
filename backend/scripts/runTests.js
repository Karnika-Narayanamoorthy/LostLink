/**
 * LostLink Backend Test Suite – 12 Scenarios
 * Pure HTTP-based tests against the live server on port 5000.
 */

const http = require('http');
let passed = 0, failed = 0;

// ── HTTP helper ────────────────────────────────────────────────────────────────
function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 5000, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload ? Buffer.byteLength(payload) : 0,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function assert(cond, msg) {
  if (cond) { console.log(`  ✅ ${msg}`); passed++; }
  else       { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Matching algorithm unit test (requires no DB) ─────────────────────────────
function testMatchingLocally() {
  require('dotenv').config();
  const { computeMatchScore, isEligibleLostItem } = require('../utils/matching');

  // TEST 3: very different items → not High
  const { score: s3, label: l3 } = computeMatchScore(
    { title: 'Mobile Phone', category: 'electronics', description: 'Samsung galaxy phone', location: 'Library',       incidentDate: new Date() },
    { title: 'Brown Wallet',  category: 'bags',         description: 'Brown leather wallet',  location: 'Sports complex', incidentDate: new Date() }
  );
  assert(l3 !== 'High', `TEST 3: Different items → not High match (score=${s3}, label=${l3||'null'})`);

  // TEST 12: different items same location → not High
  const { score: s12, label: l12 } = computeMatchScore(
    { title: 'Red Umbrella',    category: 'accessories', description: 'Red folding umbrella',        location: 'Library', incidentDate: new Date() },
    { title: 'Green Notebook',  category: 'documents',   description: 'Notebook with lecture notes', location: 'Library', incidentDate: new Date() }
  );
  assert(l12 !== 'High', `TEST 12: Different items same location → not High (score=${s12}, label=${l12||'null'})`);

  // TEST 2: lost item 4 days ago is not eligible
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  const eligible = isEligibleLostItem(
    { status: 'approved', incidentDate: fourDaysAgo },
    new Date()
  );
  assert(!eligible, 'TEST 2 (unit): Lost item 4 days ago is NOT eligible for matching');
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   LostLink Test Suite – 12 Scenarios');
  console.log('═══════════════════════════════════════════════════\n');

  // ── Setup ──────────────────────────────────────────────────────────────
  const stamp = Date.now();
  const emailA = `studentA${stamp}@kpriet.ac.in`;
  const emailB = `studentB${stamp}@kpriet.ac.in`;

  const rA = await req('POST', '/api/auth/register', { name: `Student A`, email: emailA, password: 'pass1234', section: 'CSE-A' });
  assert(rA.body.success, 'Student A registered');
  const tokenA = rA.body.token;

  const rB = await req('POST', '/api/auth/register', { name: `Student B`, email: emailB, password: 'pass1234', section: 'CSE-B' });
  assert(rB.body.success, 'Student B registered');
  const tokenB = rB.body.token;

  const rAdmin = await req('POST', '/api/auth/login', { email: 'admin@kpriet.ac.in', password: 'admin1234' });
  assert(rAdmin.body.success, 'Admin logged in');
  const tokenAdmin = rAdmin.body.token;
  if (!tokenAdmin) { console.error('Admin login failed – aborting'); process.exit(1); }

  // ── TEST 1 ─────────────────────────────────────────────────────────────
  console.log('\n── TEST 1: Match within 3 days → notification sent ────────');
  const today = new Date().toISOString();

  const rLost = await req('POST', '/api/items', {
    title: 'Black Backpack', category: 'bags',
    description: 'Black backpack with laptop compartment and blue keychain',
    location: 'Central Park', type: 'lost', incidentDate: today
  }, tokenA);
  assert(rLost.body.success, 'Student A: lost report submitted');
  const lostItemId = rLost.body.item._id;

  const rFound = await req('POST', '/api/items', {
    title: 'Black Backpack', category: 'bags',
    description: 'Black backpack found near Central Park entrance',
    location: 'Central Park', type: 'found', incidentDate: today,
    verificationCharacteristic: 'Small blue keychain attached to side pocket'
  }, tokenB);
  assert(rFound.body.success, 'Student B: found report submitted');
  const foundItemId = rFound.body.item._id;

  // Approve → triggers matching
  const rApprove = await req('PATCH', `/api/admin/items/${foundItemId}/status`,
    { status: 'approved', adminNote: 'Verified by admin' }, tokenAdmin);
  assert(rApprove.body.success, 'Admin approved found item');
  await sleep(800); // let async matching complete

  const rNotif1 = await req('GET', '/api/notifications?limit=20', null, tokenA);
  assert(rNotif1.body.success, 'Student A: notifications fetched');
  const matchN = (rNotif1.body.notifications || []).find(n => n.type === 'ITEM_MATCH');
  assert(!!matchN, 'TEST 1: Student A received ITEM_MATCH notification');
  if (matchN) assert(matchN.matchScore >= 60, `TEST 1: Match score ≥ 60 (got ${matchN.matchScore})`);

  // ── TEST 2 ─────────────────────────────────────────────────────────────
  console.log('\n── TEST 2: Lost 4 days ago → no notification ───────────────');
  // (Handled by unit test below with isEligibleLostItem)
  // Also verify via API: old lost → approve new similar found → no new match notif
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const rOldLost = await req('POST', '/api/items', {
    title: 'Old Blue Bag', category: 'bags',
    description: 'Blue bag lost 4 days ago', location: 'Chanakya Block',
    type: 'lost', incidentDate: fourDaysAgo
  }, tokenA);
  const oldLostId = rOldLost.body.item._id;

  const rNewFound = await req('POST', '/api/items', {
    title: 'Blue Bag', category: 'bags',
    description: 'Blue bag found today', location: 'Chanakya Block',
    type: 'found', incidentDate: today, verificationCharacteristic: 'zipper detail'
  }, tokenB);
  const newFoundId2 = rNewFound.body.item._id;
  await req('PATCH', `/api/admin/items/${newFoundId2}/status`, { status: 'approved' }, tokenAdmin);
  await sleep(600);

  const rNotif2 = await req('GET', '/api/notifications?limit=50', null, tokenA);
  const badMatch = (rNotif2.body.notifications || []).find(n =>
    n.type === 'ITEM_MATCH' &&
    n.relatedLostItem && String(n.relatedLostItem._id || n.relatedLostItem) === String(oldLostId)
  );
  assert(!badMatch, 'TEST 2: No notification for 4-day-old lost item');

  // ── TEST 3 & 12: Algorithm unit tests ──────────────────────────────────
  console.log('\n── TEST 3 & 12: Algorithm unit tests ───────────────────────');
  testMatchingLocally();

  // ── TEST 4 ─────────────────────────────────────────────────────────────
  console.log('\n── TEST 4: Rejected found item → no notification ───────────');
  const rFoundReject = await req('POST', '/api/items', {
    title: 'Black Backpack', category: 'bags',
    description: 'Another black bag', location: 'Central Park',
    type: 'found', incidentDate: today, verificationCharacteristic: 'test'
  }, tokenB);
  const rejectId = rFoundReject.body.item._id;

  const notifsBefore = (await req('GET', '/api/notifications?limit=50', null, tokenA)).body.notifications.length;
  await req('PATCH', `/api/admin/items/${rejectId}/status`, { status: 'rejected', adminNote: 'Fake' }, tokenAdmin);
  await sleep(500);

  const notifsAfterReject = (await req('GET', '/api/notifications?limit=50', null, tokenA)).body.notifications;
  const newMatchAfterReject = notifsAfterReject.find(n =>
    n.type === 'ITEM_MATCH' &&
    n.relatedItem && String(n.relatedItem._id || n.relatedItem) === String(rejectId)
  );
  assert(!newMatchAfterReject, 'TEST 4: No ITEM_MATCH notification for rejected item');

  // ── TEST 5 ─────────────────────────────────────────────────────────────
  console.log('\n── TEST 5: Pending found → no points ───────────────────────');
  const rMeB_before = await req('GET', '/api/auth/me', null, tokenB);
  const ptsBefore   = rMeB_before.body.user.contributionPoints;

  const rFoundPending = await req('POST', '/api/items', {
    title: 'Water Bottle', category: 'accessories',
    description: 'Red water bottle', location: 'Phoenix Circle',
    type: 'found', incidentDate: today, verificationCharacteristic: 'Sticker on side'
  }, tokenB);
  const pendingId = rFoundPending.body.item._id;

  const rMeB_afterPending = await req('GET', '/api/auth/me', null, tokenB);
  assert(rMeB_afterPending.body.user.contributionPoints === ptsBefore,
    `TEST 5: No points while pending (still ${ptsBefore})`);

  // ── TEST 6 ─────────────────────────────────────────────────────────────
  console.log('\n── TEST 6: Admin approves → +5 points ──────────────────────');
  await req('PATCH', `/api/admin/items/${pendingId}/status`, { status: 'approved' }, tokenAdmin);
  await sleep(400);
  const rMeB6 = await req('GET', '/api/auth/me', null, tokenB);
  assert(rMeB6.body.user.contributionPoints === ptsBefore + 5,
    `TEST 6: +5 pts after approval (was ${ptsBefore}, now ${rMeB6.body.user.contributionPoints})`);

  // ── TEST 7 ─────────────────────────────────────────────────────────────
  console.log('\n── TEST 7: Item returned → +15 more points ─────────────────');
  await req('PATCH', `/api/admin/items/${pendingId}/status`, { status: 'returned' }, tokenAdmin);
  await sleep(400);
  const rMeB7 = await req('GET', '/api/auth/me', null, tokenB);
  assert(rMeB7.body.user.contributionPoints === ptsBefore + 20,
    `TEST 7: +20 total (was ${ptsBefore}, now ${rMeB7.body.user.contributionPoints})`);

  // ── TEST 8 ─────────────────────────────────────────────────────────────
  console.log('\n── TEST 8: Duplicate point prevention ──────────────────────');
  // Try approving again — should not re-award
  await req('PATCH', `/api/admin/items/${pendingId}/status`, { status: 'approved' }, tokenAdmin);
  await sleep(300);
  const rMeB8 = await req('GET', '/api/auth/me', null, tokenB);
  assert(rMeB8.body.user.contributionPoints === ptsBefore + 20,
    `TEST 8: Score unchanged on second approval attempt (${rMeB8.body.user.contributionPoints})`);

  // ── TEST 9 ─────────────────────────────────────────────────────────────
  console.log('\n── TEST 9: Notification privacy ─────────────────────────────');
  const rBNotifs = await req('GET', '/api/notifications?limit=50', null, tokenB);
  const rANotifs = await req('GET', '/api/notifications?limit=50', null, tokenA);
  const bIds = new Set((rBNotifs.body.notifications || []).map(n => n._id));
  const aSeesB = (rANotifs.body.notifications || []).some(n => bIds.has(n._id));
  assert(!aSeesB, 'TEST 9: Student A cannot see Student B notifications');

  // Also verify 403 when accessing another user's notification by ID
  const bNotifId = (rBNotifs.body.notifications || [])[0]?._id;
  if (bNotifId) {
    const rSteal = await req('PATCH', `/api/notifications/${bNotifId}/read`, null, tokenA);
    assert(rSteal.status === 404 || rSteal.status === 403,
      `TEST 9: Student A gets ${rSteal.status} accessing B's notification`);
  }

  // ── TEST 10 ────────────────────────────────────────────────────────────
  console.log('\n── TEST 10: Score manipulation prevention ───────────────────');
  const ptsBefore10 = rMeB8.body.user.contributionPoints;
  await req('PUT', '/api/auth/profile', { contributionPoints: 99999, role: 'admin' }, tokenA);
  const rMeA10 = await req('GET', '/api/auth/me', null, tokenA);
  assert(rMeA10.body.user.contributionPoints === 0, 'TEST 10: Points not set via profile endpoint');
  assert(rMeA10.body.user.role === 'student',        'TEST 10: Role not elevated via profile endpoint');

  // ── TEST 11 ────────────────────────────────────────────────────────────
  console.log('\n── TEST 11: Notifications persist across logout/login ────────');
  const rRelogin = await req('POST', '/api/auth/login', { email: emailA, password: 'pass1234' });
  assert(rRelogin.body.success, 'TEST 11: Student A re-logged in');
  const tokenA2 = rRelogin.body.token;
  const rPersist = await req('GET', '/api/notifications?limit=20', null, tokenA2);
  assert(rPersist.body.success,    'TEST 11: Notifications API accessible after re-login');
  assert((rPersist.body.total || 0) > 0, `TEST 11: Notifications persisted (total ${rPersist.body.total})`);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`   Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
})().catch(err => { console.error('Fatal:', err); process.exit(1); });
