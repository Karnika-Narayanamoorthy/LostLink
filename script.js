// =====================================================
// LOSTLINK – Campus Lost & Found
// Full-stack frontend – connects to Express/MongoDB backend
// =====================================================

const API = 'http://localhost:5000/api';

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser      = null;
let authToken        = null;
let currentPage      = 1;
let currentTypeFilter= 'all';
let currentSearch    = '';
let totalPages       = 1;
let currentClaimItemId = null;
let currentAdminTab  = 'pending';
let lbFilter         = 'overall';
let socketIO         = null;
let unreadCount      = 0;
let notifDropdownOpen= false;
let userMenuOpen     = false;
let mobileMenuOpen   = false;

// ── Precise campus location coordinates ──────────────────────────────────────
// Each entry: [xPercent, yPercent] mapped from the actual campus map image.
// x=0 is left edge, x=100 is right edge; y=0 is top, y=100 is bottom.
const LOCATION_COORDS = {
  'Gate 01':              { x: 49.5,  y: 90.5 },
  'Gate 02':              { x: 64.5,  y:  8.0 },
  'Gate 03':              { x: 37.5,  y: 37.5 },
  'Gate 04':              { x: 27.5,  y: 60.5 },
  'Gate 05':              { x: 91.0,  y: 40.5 },
  'Gate 06':              { x: 96.5,  y: 46.5 },
  'Gate 07':              { x: 37.0,  y: 15.5 },
  'Unity Junction':       { x: 48.5,  y: 59.5 },
  'CV Raman Square':      { x: 50.5,  y: 28.5 },
  'Chanakya Block':       { x: 63.5,  y: 42.0 },
  'Aryabhatta Block':     { x: 55.5,  y: 18.5 },
  'Bhaskara Block':       { x: 69.0,  y: 17.0 },
  'Sanskriti Auditorium': { x: 46.0,  y: 42.5 },
  'Thiruvalluvar Hostel': { x: 37.5,  y: 24.5 },
  'Cholan Hostel':        { x: 25.5,  y: 46.0 },
  'Pandian Hostel':       { x: 25.5,  y: 53.5 },
  'Pallavan Hostel':      { x: 23.0,  y: 50.5 },
  'Bharathi Hostel':      { x: 27.5,  y: 28.5 },
  'Cheran Hostel':        { x: 33.5,  y: 31.5 },
  'Vivekanandha Hostel':  { x: 10.5,  y: 27.5 },
  'Ganga Hostel':         { x: 93.5,  y: 19.5 },
  'Yamuna Hostel':        { x: 92.0,  y: 28.5 },
  'Kaveri Hostel':        { x: 90.5,  y: 38.5 },
  'Mythreyi Block':       { x: 80.5,  y: 51.5 },
  'Central Park':         { x: 79.5,  y: 28.5 },
  'Phoenix Circle':       { x: 62.0,  y: 60.5 },
  'KPR Sports Complex':   { x:  4.5,  y: 57.0 },
  'Fitness Studio':       { x: 33.0,  y: 55.5 },
  'Olive Dining':         { x: 47.5,  y: 74.5 },
  'Pavilion':             { x: 47.0,  y: 66.5 },
  'Lake View Parking':    { x: 68.0,  y: 76.5 },
  'Mahogany Parking':     { x: 79.5,  y: 13.5 },
  'Aero Zone':            { x: 83.0,  y:  4.0 },
  'Racing Bay':           { x: 83.5,  y: 19.0 },
};

const CAMPUS_LOCATIONS = Object.keys(LOCATION_COORDS);

const BADGE_EMOJIS = {
  'Starter Badge':  '🏅',
  'Bronze Badge':   '🥉',
  'Silver Badge':   '🥈',
  'Gold Badge':     '🥇',
  'Platinum Badge': '💎'
};

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  populateLocationSelects();
  setTodayDates();
  restoreSession();

  // Close dropdowns on outside click
  document.addEventListener('click', handleOutsideClick);
});

// ── API helper ────────────────────────────────────────────────────────────────
async function apiCall(method, path, body = null, isFormData = false) {
  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  try {
    const res  = await fetch(`${API}${path}`, opts);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { success: false, message: 'Network error. Is the server running?' } };
  }
}

// ── Session ───────────────────────────────────────────────────────────────────
function restoreSession() {
  const saved = localStorage.getItem('ll_token');
  const user  = localStorage.getItem('ll_user');
  if (saved && user) {
    authToken   = saved;
    currentUser = JSON.parse(user);
    updateNavForUser();
    initSocket();
    loadUnreadCount();
  }
  loadItems();
  loadStats();
}

function saveSession(token, user) {
  authToken   = token;
  currentUser = user;
  localStorage.setItem('ll_token', token);
  localStorage.setItem('ll_user', JSON.stringify(user));
}

function clearSession() {
  authToken   = null;
  currentUser = null;
  localStorage.removeItem('ll_token');
  localStorage.removeItem('ll_user');
  if (socketIO) { socketIO.disconnect(); socketIO = null; }
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
function initSocket() {
  if (!authToken) return;
  if (socketIO && socketIO.connected) return;

  socketIO = io('http://localhost:5000', { auth: { token: authToken } });

  socketIO.on('connect', () => {
    console.log('🔔 Real-time notifications connected');
  });

  socketIO.on('notification:new', (notif) => {
    unreadCount++;
    updateBadge();
    showToast(`🔔 ${notif.title}`, 'info');
    // Refresh dropdown if open
    if (notifDropdownOpen) loadNotifDropdown();
  });

  socketIO.on('connect_error', () => {
    // Silently fall back to polling
    startNotifPolling();
  });
}

let pollingInterval = null;
function startNotifPolling() {
  if (pollingInterval) return;
  pollingInterval = setInterval(() => {
    if (authToken) loadUnreadCount();
  }, 30000);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function loginUser(e) {
  e.preventDefault();
  setFormState('loginBtn', 'loginMsg', true, '');

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const { ok, data } = await apiCall('POST', '/auth/login', { email, password });
  if (ok && data.success) {
    saveSession(data.token, data.user);
    updateNavForUser();
    initSocket();
    loadUnreadCount();
    closeModal('loginModal');
    showToast('Welcome back, ' + data.user.name + '!', 'success');
    if (data.user.role === 'admin') showPage('admin');
    else loadItems();
  } else {
    setFormState('loginBtn', 'loginMsg', false, data.message || 'Login failed');
  }
}

async function registerUser(e) {
  e.preventDefault();
  setFormState('registerBtn', 'registerMsg', true, '');

  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const section  = document.getElementById('regSection').value.trim();
  const password = document.getElementById('regPassword').value;

  const { ok, data } = await apiCall('POST', '/auth/register', { name, email, section, password });
  if (ok && data.success) {
    saveSession(data.token, data.user);
    updateNavForUser();
    initSocket();
    loadUnreadCount();
    closeModal('registerModal');
    showToast('Account created! Welcome, ' + data.user.name + '!', 'success');
    loadItems();
  } else {
    setFormState('registerBtn', 'registerMsg', false, data.message || 'Registration failed');
  }
}

function logoutUser() {
  clearSession();
  updateNavForGuest();
  showPage('home');
  showToast('Logged out successfully', 'success');
  // Reset unread
  unreadCount = 0;
  updateBadge();
}

function requireAuth(fn) {
  if (currentUser) fn();
  else { showToast('Please log in first', 'info'); openModal('loginModal'); }
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function updateNavForUser() {
  document.getElementById('guestButtons').style.display   = 'none';
  document.getElementById('userMenuWrap').style.display   = 'flex';
  document.getElementById('notifBellWrap').style.display  = 'flex';
  document.getElementById('mobileGuestBtns').style.display= 'none';
  document.getElementById('mobileUserBtns').style.display = 'block';

  const name = currentUser.name || 'User';
  document.getElementById('userNameShort').textContent    = name.split(' ')[0];
  document.getElementById('avatarCircle').textContent     = name.charAt(0).toUpperCase();
  document.getElementById('userDropdownName').textContent = name;

  if (currentUser.role === 'admin') {
    // Add admin link if not there
    const dd = document.getElementById('userDropdown');
    if (!document.getElementById('adminLink')) {
      const a = document.createElement('a');
      a.id = 'adminLink';
      a.textContent = '⚙ Admin Dashboard';
      a.onclick = () => { window.open('/admin', '_blank'); closeUserMenu(); };
      dd.insertBefore(a, dd.querySelector('hr'));
    }
  }
}

function updateNavForGuest() {
  document.getElementById('guestButtons').style.display   = 'flex';
  document.getElementById('userMenuWrap').style.display   = 'none';
  document.getElementById('notifBellWrap').style.display  = 'none';
  document.getElementById('mobileGuestBtns').style.display= 'block';
  document.getElementById('mobileUserBtns').style.display = 'none';
}

// ── Page routing ──────────────────────────────────────────────────────────────
const PAGES = ['home','notifications','dashboard','leaderboard','item-detail','admin','activity','monthly-rewards'];

function showPage(name) {
  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(`page-${name}`);
  if (target) target.style.display = 'block';

  const footer = document.getElementById('mainFooter');
  footer.style.display = name === 'home' ? '' : 'none';

  window.scrollTo(0, 0);

  // Load content for each page
  if (name === 'home')            { loadItems(); loadStats(); }
  if (name === 'notifications')   loadNotifPage();
  if (name === 'dashboard')       { requireAuth(loadDashboard); }
  if (name === 'leaderboard')     loadLeaderboard();
  if (name === 'activity')        { requireAuth(loadActivityPage); }
  if (name === 'monthly-rewards') loadMonthlyRewardsPage();
  if (name === 'admin') {
    if (!currentUser || currentUser.role !== 'admin') {
      showPage('home');
      showToast('Admin access required', 'error');
      return;
    }
    loadAdminStats();
    loadAdminTab('pending');
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  const { ok, data } = await apiCall('GET', '/admin/stats');
  if (ok && data.success) {
    const s = data.stats;
    document.getElementById('statTotal').textContent   = s.totalItems  || 0;
    document.getElementById('statFound').textContent   = s.approvedItems|| 0;
    document.getElementById('statReturned').textContent= s.returnedItems|| 173;
  }
}

// ── Items ─────────────────────────────────────────────────────────────────────
async function loadItems() {
  const grid = document.getElementById('itemsGrid');
  grid.innerHTML = '<div class="items-loading"><div class="spinner"></div></div>';

  const cat  = document.getElementById('categoryFilter').value || 'all';
  const qs   = new URLSearchParams({
    page:     currentPage,
    limit:    6,
    type:     currentTypeFilter,
    category: cat
  });
  if (currentSearch) qs.set('search', currentSearch);

  const { ok, data } = await apiCall('GET', `/items?${qs}`);
  if (!ok || !data.success) {
    grid.innerHTML = '<div class="no-items" style="grid-column:1/-1">Could not load items. Make sure the server is running.</div>';
    return;
  }

  totalPages = data.totalPages || 1;
  renderItemCards(data.items, grid);
  renderPagination();
}

function renderItemCards(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = '';
    document.getElementById('emptyState').style.display = 'block';
    return;
  }
  document.getElementById('emptyState').style.display = 'none';
  container.innerHTML = items.map(item => itemCardHTML(item)).join('');
}

function itemCardHTML(item) {
  const colorClass = { electronics:'purple', bags:'blue', documents:'yellow',
                       accessories:'pink', clothing:'green', other:'orange' }[item.category] || 'purple';
  const emoji      = { electronics:'📱', bags:'🎒', documents:'🪪',
                       accessories:'⌚', clothing:'👕', other:'📦' }[item.category] || '📦';
  const img = item.imageUrl
    ? `<img src="${item.imageUrl}" alt="${escHtml(item.title)}" style="width:100%;height:100%;object-fit:cover">`
    : `<div class="image-placeholder">${emoji}</div>`;

  const claimBtn = (item.type === 'found' && currentUser && item.reportedBy?._id !== currentUser._id)
    ? `<button class="claim-btn" onclick="openClaimModal('${item._id}','${escHtml(item.title)}')">Claim Item</button>`
    : '';

  const statusBadge = { pending:'pending', approved:'found', rejected:'rejected',
                         returned:'returned', cancelled:'cancelled' }[item.status] || item.type;

  return `<article class="item-card" onclick="viewItem('${item._id}')" style="cursor:pointer">
    <div class="item-image ${colorClass}">
      ${img}
      <span class="status ${item.type}">${item.type.toUpperCase()}</span>
      ${item.status !== 'approved' ? `<span class="status-overlay">${item.status.toUpperCase()}</span>` : ''}
    </div>
    <div class="item-body">
      <div class="item-title"><h3>${escHtml(item.title)}</h3><span>⋮</span></div>
      <p class="location">📍 ${escHtml(item.location)}</p>
      <p class="date">${timeAgo(item.createdAt)}</p>
      <div class="item-actions">
        <button onclick="event.stopPropagation();locateItem('${escHtml(item.location)}')">Locate on map →</button>
        ${claimBtn}
      </div>
    </div>
  </article>`;
}

function loadAllItems() {
  currentPage = 1;
  currentTypeFilter = 'all';
  currentSearch = '';
  document.getElementById('heroSearch').value = '';
  loadItems();
  document.getElementById('browse').scrollIntoView({ behavior: 'smooth' });
}

async function loadStats() {
  const { ok, data } = await apiCall('GET', '/admin/stats');
  if (ok && data.success) {
    const s = data.stats;
    document.getElementById('statTotal').textContent    = s.totalItems   || 0;
    document.getElementById('statFound').textContent    = s.approvedItems|| 0;
    document.getElementById('statReturned').textContent = s.returnedItems || 173;
  }
}

// ── Filters & search ──────────────────────────────────────────────────────────
function setTypeFilter(type, btn) {
  currentTypeFilter = type;
  currentPage = 1;
  document.querySelectorAll('.filter-row .filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadItems();
}

function applyFilters() {
  currentPage = 1;
  loadItems();
}

function searchItems() {
  currentSearch = document.getElementById('heroSearch').value.trim();
  currentPage   = 1;
  loadItems();
  document.getElementById('browse').scrollIntoView({ behavior: 'smooth' });
}

function handleSearchKey(e) {
  if (e.key === 'Enter') searchItems();
}

// ── Pagination ────────────────────────────────────────────────────────────────
function renderPagination() {
  const row = document.getElementById('paginationRow');
  if (totalPages <= 1) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  document.getElementById('pageInfo').textContent    = `Page ${currentPage} of ${totalPages}`;
  document.getElementById('prevPageBtn').disabled    = currentPage <= 1;
  document.getElementById('nextPageBtn').disabled    = currentPage >= totalPages;
}

function changePage(dir) {
  const next = currentPage + dir;
  if (next < 1 || next > totalPages) return;
  currentPage = next;
  loadItems();
  document.getElementById('browse').scrollIntoView({ behavior: 'smooth' });
}

// ── Item Detail ───────────────────────────────────────────────────────────────
async function viewItem(id) {
  showPage('item-detail');
  const content = document.getElementById('itemDetailContent');
  content.innerHTML = '<div class="items-loading"><div class="spinner"></div></div>';

  const { ok, data } = await apiCall('GET', `/items/${id}`);
  if (!ok || !data.success) {
    content.innerHTML = '<p class="empty-state" style="display:block">Item not found.</p>';
    return;
  }

  const item = data.item;
  const isOwner = currentUser && item.reportedBy?._id === currentUser._id;
  const colorClass = { electronics:'purple', bags:'blue', documents:'yellow',
                        accessories:'pink', clothing:'green', other:'orange' }[item.category] || 'purple';

  content.innerHTML = `
    <div class="item-detail-card">
      <div class="item-detail-img ${colorClass}">
        ${item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${escHtml(item.title)}">`
          : `<div class="detail-placeholder">${{electronics:'📱',bags:'🎒',documents:'🪪',accessories:'⌚',clothing:'👕',other:'📦'}[item.category]||'📦'}</div>`}
        <span class="status ${item.type}">${item.type.toUpperCase()}</span>
      </div>
      <div class="item-detail-body">
        <div class="item-detail-meta">
          <span class="eyebrow">${item.category.toUpperCase()}</span>
          <h2>${escHtml(item.title)}</h2>
          <p class="location">📍 ${escHtml(item.location)}</p>
          <p class="date">Reported ${timeAgo(item.createdAt)}</p>
          ${item.reportedBy ? `<p class="detail-reporter">By: ${escHtml(item.reportedBy.name)}${item.reportedBy.section?' – '+escHtml(item.reportedBy.section):''}</p>` : ''}
        </div>
        <p class="detail-description">${escHtml(item.description || 'No description provided.')}</p>
        <div class="detail-status-badge status-${item.status}">${item.status.toUpperCase()}</div>
        ${!isOwner && item.type === 'found' && item.status === 'approved'
          ? `<button class="primary-btn full" style="margin-top:18px" onclick="openClaimModal('${item._id}','${escHtml(item.title)}')">Submit Claim</button>`
          : ''}
        ${isOwner ? `<p style="font-size:12px;color:var(--muted);margin-top:12px">This is your report.</p>` : ''}
      </div>
    </div>`;
}

// ── Report forms ──────────────────────────────────────────────────────────────
async function submitLostReport(e) {
  e.preventDefault();
  if (!currentUser) return showToast('Please log in first', 'error');

  const btn = document.getElementById('lostSubmitBtn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  const fd = new FormData();
  fd.append('title',       document.getElementById('lostItemName').value.trim());
  fd.append('category',    document.getElementById('lostCategory').value);
  fd.append('location',    document.getElementById('lostLocation').value);
  fd.append('type',        'lost');
  fd.append('description', document.getElementById('lostDescription').value.trim());
  fd.append('incidentDate',document.getElementById('lostDate').value);
  const file = document.getElementById('lostItemImage').files[0];
  if (file) fd.append('image', file);

  const { ok, data } = await apiCall('POST', '/items', fd, true);
  btn.disabled = false; btn.textContent = 'Submit Lost Report';

  if (ok && data.success) {
    showToast('Lost report submitted! Pending admin review.', 'success');
    closeModal('lostModal');
    document.getElementById('lostForm').reset();
    document.getElementById('lostPreview').style.display = 'none';
    loadItems();
  } else {
    document.getElementById('lostFormMsg').textContent = data.message || 'Submission failed';
    document.getElementById('lostFormMsg').className   = 'form-msg error';
  }
}

async function submitFoundReport(e) {
  e.preventDefault();
  if (!currentUser) return showToast('Please log in first', 'error');

  const btn = document.getElementById('foundSubmitBtn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  const fd = new FormData();
  fd.append('title',                    document.getElementById('foundItemName').value.trim());
  fd.append('category',                 document.getElementById('foundCategory').value);
  fd.append('location',                 document.getElementById('foundLocation').value);
  fd.append('type',                     'found');
  fd.append('description',              document.getElementById('foundDescription').value.trim());
  fd.append('incidentDate',             document.getElementById('foundDate').value);
  fd.append('verificationCharacteristic', document.getElementById('verificationCharacteristic').value.trim());
  const file = document.getElementById('foundItemImage').files[0];
  if (file) fd.append('image', file);

  const { ok, data } = await apiCall('POST', '/items', fd, true);
  btn.disabled = false; btn.textContent = 'Submit Found Report';

  if (ok && data.success) {
    showToast('Found report submitted! Pending admin review. You earn +5 pts once approved.', 'success');
    closeModal('foundModal');
    document.getElementById('foundForm').reset();
    document.getElementById('foundPreview').style.display = 'none';
    loadItems();
  } else {
    document.getElementById('foundFormMsg').textContent = data.message || 'Submission failed';
    document.getElementById('foundFormMsg').className   = 'form-msg error';
  }
}

// ── Claim ─────────────────────────────────────────────────────────────────────
function openClaimModal(itemId, itemName) {
  if (!currentUser) { showToast('Please log in to submit a claim', 'info'); openModal('loginModal'); return; }
  currentClaimItemId = itemId;
  document.getElementById('claimItemName').textContent  = itemName;
  document.getElementById('claimAnswer').value          = '';
  document.getElementById('claimAdditionalInfo').value  = '';
  document.getElementById('claimFormMsg').textContent   = '';
  openModal('claimModal');
}

async function submitClaim(e) {
  e.preventDefault();
  const btn = document.getElementById('claimSubmitBtn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  const answer         = document.getElementById('claimAnswer').value.trim();
  const additionalInfo = document.getElementById('claimAdditionalInfo').value.trim();

  const { ok, data } = await apiCall('POST', `/items/${currentClaimItemId}/claims`,
    { verificationAnswer: answer, additionalInfo });

  btn.disabled = false; btn.textContent = 'Submit Claim';

  if (ok && data.success) {
    showToast('Claim submitted! Admin will review it shortly.', 'success');
    closeModal('claimModal');
  } else {
    document.getElementById('claimFormMsg').textContent = data.message || 'Claim failed';
    document.getElementById('claimFormMsg').className   = 'form-msg error';
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────
async function loadUnreadCount() {
  if (!authToken) return;
  const { ok, data } = await apiCall('GET', '/notifications/unread-count');
  if (ok && data.success) {
    unreadCount = data.count;
    updateBadge();
  }
}

function updateBadge() {
  const badge = document.getElementById('notifBadge');
  if (unreadCount > 0) {
    badge.style.display  = 'flex';
    badge.textContent    = unreadCount > 99 ? '99+' : unreadCount;
  } else {
    badge.style.display  = 'none';
  }
}

async function loadNotifDropdown() {
  const list = document.getElementById('notifList');
  list.innerHTML = '<div style="padding:14px;text-align:center"><div class="spinner" style="margin:auto"></div></div>';

  const { ok, data } = await apiCall('GET', '/notifications?limit=5');
  if (!ok || !data.success) {
    list.innerHTML = '<div class="notif-empty">Could not load notifications.</div>';
    return;
  }

  const notifs = data.notifications || [];
  if (notifs.length === 0) {
    list.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
    return;
  }

  list.innerHTML = notifs.map(n => notifItemHTML(n, true)).join('');
}

function notifItemHTML(n, compact = false) {
  const unread = !n.isRead ? 'notif-item--unread' : '';
  const icon   = { ITEM_MATCH: '🎯', CLAIM_UPDATE: '📋', ITEM_UPDATE: '✅', SYSTEM: '🔔' }[n.type] || '🔔';
  const labelBadge = n.matchLabel
    ? `<span class="match-badge match-${n.matchLabel.toLowerCase()}">${n.matchLabel}</span>`
    : '';
  const thumb = n.relatedItem?.imageUrl
    ? `<img class="notif-thumb" src="${n.relatedItem.imageUrl}" alt="">`
    : '';
  const locText = n.relatedItem?.location ? `<span class="notif-loc">📍 ${escHtml(n.relatedItem.location)}</span>` : '';
  const viewBtn = n.relatedItem?._id
    ? `<button class="notif-view-btn" onclick="event.stopPropagation();markNotifRead('${n._id}');viewItem('${n.relatedItem._id}')">View Item</button>`
    : '';

  return `<div class="notif-item ${unread}" onclick="markNotifRead('${n._id}')">
    <div class="notif-icon-wrap">${icon}</div>
    <div class="notif-content">
      <div class="notif-title-row">
        <strong>${escHtml(n.title)}</strong>${labelBadge}
      </div>
      <p class="notif-msg">${escHtml(n.message)}</p>
      ${thumb}
      ${locText}
      <div class="notif-footer-row">
        <span class="notif-time">${timeAgo(n.createdAt)}</span>
        ${viewBtn}
      </div>
    </div>
    ${!n.isRead ? '<div class="notif-dot"></div>' : ''}
  </div>`;
}

function toggleNotifDropdown() {
  notifDropdownOpen = !notifDropdownOpen;
  const dd = document.getElementById('notifDropdown');
  dd.classList.toggle('open', notifDropdownOpen);
  if (notifDropdownOpen) loadNotifDropdown();
}

async function markNotifRead(id) {
  await apiCall('PATCH', `/notifications/${id}/read`);
  loadUnreadCount();
  if (notifDropdownOpen) loadNotifDropdown();
  // Also refresh page if on notifications page
  if (document.getElementById('page-notifications').style.display !== 'none') loadNotifPage();
}

async function markAllRead() {
  await apiCall('PATCH', '/notifications/read-all');
  unreadCount = 0;
  updateBadge();
  if (notifDropdownOpen) loadNotifDropdown();
  if (document.getElementById('page-notifications').style.display !== 'none') loadNotifPage();
  showToast('All notifications marked as read', 'success');
}

async function loadNotifPage() {
  const list = document.getElementById('notifPageList');
  list.innerHTML = '<div class="items-loading"><div class="spinner"></div></div>';

  if (!authToken) {
    list.innerHTML = '<p class="empty-state" style="display:block">Please log in to view notifications.</p>';
    return;
  }

  const { ok, data } = await apiCall('GET', '/notifications?limit=50');
  if (!ok || !data.success) {
    list.innerHTML = '<p class="empty-state" style="display:block">Could not load notifications.</p>';
    return;
  }

  const notifs = data.notifications || [];
  if (notifs.length === 0) {
    list.innerHTML = '<div class="notif-empty" style="padding:40px;text-align:center">You have no notifications yet.</div>';
    return;
  }

  list.innerHTML = notifs.map(n => notifItemHTML(n, false)).join('');
  loadUnreadCount();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  // Fetch fresh user data
  const { ok: okMe, data: meData } = await apiCall('GET', '/auth/me');
  if (okMe && meData.success) {
    currentUser = meData.user;
    localStorage.setItem('ll_user', JSON.stringify(currentUser));
    renderContributionCard(currentUser);
  }

  // My items
  const { ok: okItems, data: itemsData } = await apiCall('GET', '/items/mine');
  const myGrid  = document.getElementById('myItemsGrid');
  const myEmpty = document.getElementById('myItemsEmpty');
  if (okItems && itemsData.success) {
    if (itemsData.items.length === 0) {
      myGrid.innerHTML = '';
      myEmpty.style.display = 'block';
    } else {
      myEmpty.style.display = 'none';
      myGrid.innerHTML = itemsData.items.map(item => itemCardHTML(item)).join('');
    }
  }

  // Contribution history
  await loadContribHistory();
}

function renderContributionCard(user) {
  const emoji = BADGE_EMOJIS[user.contributionBadge] || '🏅';
  document.getElementById('contribBadgeIcon').textContent = emoji;
  document.getElementById('contribLevel').textContent     = user.contributionLevel;
  document.getElementById('contribBadgeName').textContent = user.contributionBadge;
  document.getElementById('contribPoints').textContent    = user.contributionPoints;
  document.getElementById('cStatTotal').textContent       = user.totalFoundReports;
  document.getElementById('cStatVerified').textContent    = user.verifiedFoundReports;
  document.getElementById('cStatReturned').textContent    = user.successfullyReturnedItems;
  document.getElementById('dashboardTitle').textContent   = `${user.name}'s Dashboard`;

  // Progress bar
  const levels = [
    { min: 0,   max: 19,  label: 'New Finder' },
    { min: 20,  max: 49,  label: 'Helpful Finder' },
    { min: 50,  max: 99,  label: 'Trusted Finder' },
    { min: 100, max: 199, label: 'Campus Hero' },
    { min: 200, max: Infinity, label: 'LostLink Legend' }
  ];
  const pts   = user.contributionPoints;
  const curr  = levels.find(l => pts >= l.min && pts <= l.max);
  const next  = user.nextLevel;

  if (next && curr) {
    const range = next.min - curr.min;
    const done  = pts - curr.min;
    const pct   = Math.min(100, Math.round((done / range) * 100));
    document.getElementById('progressFill').style.width  = pct + '%';
    document.getElementById('progressPct').textContent   = pct + '%';
    document.getElementById('progressLabel').textContent = `Progress to ${next.level}`;
    document.getElementById('progressNext').textContent  = `${next.min - pts} more points needed`;
  } else {
    document.getElementById('progressFill').style.width  = '100%';
    document.getElementById('progressPct').textContent   = '100%';
    document.getElementById('progressLabel').textContent = 'Maximum level reached!';
    document.getElementById('progressNext').textContent  = '🏆 LostLink Legend';
  }
}

async function loadContribHistory() {
  const list   = document.getElementById('contribHistoryList');
  const empty  = document.getElementById('contribHistoryEmpty');
  list.innerHTML = '<div class="items-loading"><div class="spinner"></div></div>';

  const { ok, data } = await apiCall('GET', '/contributions/history?limit=20');
  if (!ok || !data.success) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  const history = data.history || [];
  if (history.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = history.map(h => `
    <div class="contrib-history-item">
      <div class="contrib-history-icon">${h.action === 'REPORT_APPROVED' ? '✅' : '🏆'}</div>
      <div class="contrib-history-body">
        <strong>${escHtml(h.description)}</strong>
        <span>${h.item ? escHtml(h.item.title) : ''}</span>
        <small>${timeAgo(h.createdAt)}</small>
      </div>
      <div class="contrib-history-pts">+${h.points} pts</div>
    </div>`).join('');
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = '<tr><td colspan="6" class="lb-loading"><div class="spinner"></div></td></tr>';

  const { ok, data } = await apiCall('GET', `/contributions/leaderboard?filter=${lbFilter}&limit=20`);
  if (!ok || !data.success) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">Could not load leaderboard.</td></tr>';
    return;
  }

  const lb = data.leaderboard || [];
  if (lb.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">No data yet.</td></tr>';
    return;
  }

  tbody.innerHTML = lb.map(u => {
    const rankIcon = u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : `#${u.rank}`;
    const emoji    = BADGE_EMOJIS[u.contributionBadge] || '🏅';
    const pts      = lbFilter === 'overall' ? u.totalPoints : u.periodPoints;
    return `<tr class="${u.rank <= 3 ? 'lb-top' : ''}">
      <td class="lb-rank">${rankIcon}</td>
      <td class="lb-name">${escHtml(u.name)}</td>
      <td class="lb-section">${escHtml(u.section || '—')}</td>
      <td class="lb-badge"><span class="badge-pill" style="background:${u.contributionBadgeColor}20;color:${u.contributionBadgeColor}">${emoji} ${escHtml(u.contributionBadge||'')}</span></td>
      <td class="lb-pts"><strong>${pts}</strong></td>
      <td class="lb-ret">${u.successfullyReturnedItems}</td>
    </tr>`;
  }).join('');
}

function setLeaderboardFilter(filter, btn) {
  lbFilter = filter;
  document.querySelectorAll('.leaderboard-filters .filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadLeaderboard();
}

// ── Admin dashboard ───────────────────────────────────────────────────────────
async function loadAdminStats() {
  const { ok, data } = await apiCall('GET', '/admin/stats');
  if (ok && data.success) {
    const s = data.stats;
    document.getElementById('aStatPending').textContent  = s.pendingItems;
    document.getElementById('aStatApproved').textContent = s.approvedItems;
    document.getElementById('aStatMatches').textContent  = s.totalMatches;
    document.getElementById('aStatClaims').textContent   = s.pendingClaims;
    document.getElementById('aStatUsers').textContent    = s.totalUsers;
    const rEl = document.getElementById('aStatRewards');
    if (rEl) rEl.textContent = s.pendingRewards || 0;
  }
}

function switchAdminTab(tab, btn) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadAdminTab(tab);
}

async function loadAdminTab(tab) {
  const content = document.getElementById('adminTabContent');
  content.innerHTML = '<div class="items-loading"><div class="spinner"></div></div>';

  // ── Pending / All Items ────────────────────────────────────────────────────
  if (tab === 'pending' || tab === 'all-items') {
    const status = tab === 'pending' ? 'pending' : 'all';
    const { ok, data } = await apiCall('GET', `/admin/items?status=${status}&limit=50`);
    if (!ok || !data.success) { content.innerHTML = adminErr('items'); return; }
    if (!data.items.length) {
      content.innerHTML = `<div class="admin-empty-state">
        <span>${tab==='pending'?'✅':'📦'}</span>
        <p>${tab==='pending'?'No pending reports — all caught up!':'No items found.'}</p></div>`;
      return;
    }
    content.innerHTML = `
      <div class="admin-section-info">
        ${data.total} item${data.total!==1?'s':''} ${tab==='pending'?'awaiting review':'total'}
      </div>
      <div class="admin-items-grid">${data.items.map(item => adminItemCard(item)).join('')}</div>`;
  }

  // ── Claims (full detail + verification answer) ─────────────────────────────
  else if (tab === 'claims') {
    const { ok, data } = await apiCall('GET', '/admin/claims?status=all&limit=50');
    if (!ok || !data.success) { content.innerHTML = adminErr('claims'); return; }

    const statusFilter = ['all','pending','approved','rejected'];
    const filterBtns = statusFilter.map(s =>
      `<button class="filter ${s==='all'?'active':''}" onclick="adminFilterClaims('${s}',this)">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`
    ).join('');

    if (!data.claims.length) {
      content.innerHTML = `<div class="admin-filter-bar">${filterBtns}</div>
        <div class="admin-empty-state"><span>📋</span><p>No claims yet.</p></div>`;
      return;
    }

    const rows = data.claims.map(c => {
      const hasAnswer = c.verificationAnswer;
      return `<tr data-claim-status="${c.status}">
        <td>
          <strong>${escHtml(c.item?.title||'—')}</strong><br>
          <small>${escHtml(c.item?.location||'')}</small>
          <span class="status-pill status-pill-${c.item?.type||'found'}" style="font-size:9px">${c.item?.type||''}</span>
        </td>
        <td>
          ${escHtml(c.claimant?.name||'—')}<br>
          <small>${escHtml(c.claimant?.email||'')}</small><br>
          <small>${escHtml(c.claimant?.section||'')}</small>
        </td>
        <td>
          ${hasAnswer
            ? `<div class="claim-answer-box">
                <span class="claim-answer-label">🔐 Claimant's answer:</span>
                <em>${escHtml(c.verificationAnswer)}</em>
               </div>`
            : '<small style="color:var(--muted)">No answer</small>'}
        </td>
        <td><span class="status-pill status-pill-${c.status}">${c.status}</span></td>
        <td>${fmtDate(c.createdAt)}</td>
        <td>
          ${c.status==='pending' ? `
            <button class="admin-action-btn approve" onclick="adminUpdateClaim('${c._id}','approved')">✓ Approve</button>
            <button class="admin-action-btn reject"  onclick="adminUpdateClaimWithNote('${c._id}')">✗ Reject</button>
            <button class="admin-action-btn view"    onclick="viewItem('${escHtml(c.item?._id||'')}')">View Item</button>
          ` : `<span style="color:var(--muted);font-size:12px">${c.status}</span>
               ${c.adminNote?`<br><small style="color:var(--muted)">${escHtml(c.adminNote)}</small>`:''}`}
        </td>
      </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="admin-filter-bar">${filterBtns}</div>
      <div class="admin-section-info">${data.total} claim${data.total!==1?'s':''} total</div>
      <div class="admin-table-wrap">
        <table class="admin-table" id="claimsTable">
          <thead><tr>
            <th>Item</th><th>Claimant</th><th>Verification Answer</th>
            <th>Status</th><th>Submitted</th><th>Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Smart Matches (full detail) ────────────────────────────────────────────
  else if (tab === 'matches') {
    const { ok, data } = await apiCall('GET', '/admin/matches?limit=50');
    if (!ok || !data.success) { content.innerHTML = adminErr('matches'); return; }

    if (!data.matches.length) {
      content.innerHTML = `<div class="admin-empty-state">
        <span>🎯</span><p>No smart matches yet.<br><small>Matches appear after a found item is approved and compared against recent lost reports.</small></p></div>`;
      return;
    }

    const rows = data.matches.map(m => {
      const sb = m.scoreBreakdown || {};
      const breakdownHTML = `
        <div class="score-breakdown">
          <span title="Category">Cat: <strong>${sb.category||0}</strong>/30</span>
          <span title="Title">Title: <strong>${sb.title||0}</strong>/30</span>
          <span title="Description">Desc: <strong>${sb.description||0}</strong>/20</span>
          <span title="Location">Loc: <strong>${sb.location||0}</strong>/15</span>
          <span title="Date">Date: <strong>${sb.date||0}</strong>/5</span>
        </div>`;
      const confidenceBar = `
        <div class="confidence-bar-wrap">
          <div class="confidence-bar" style="width:${m.score}%;background:${m.score>=80?'var(--success)':m.score>=60?'#f59e0b':'var(--danger)'}"></div>
        </div>`;
      return `<tr>
        <td>
          <strong>${escHtml(m.foundItem?.title||'—')}</strong><br>
          <small>By: ${escHtml(m.foundItem?.reportedBy?.name||'?')}</small><br>
          <small>📍 ${escHtml(m.foundItem?.location||'')}</small>
          <button class="admin-action-btn view" style="margin-top:6px" onclick="viewItem('${m.foundItem?._id||''}')">View</button>
        </td>
        <td>
          <strong>${escHtml(m.lostItem?.title||'—')}</strong><br>
          <small>By: ${escHtml(m.lostItem?.reportedBy?.name||'?')}</small><br>
          <small>📍 ${escHtml(m.lostItem?.location||'')}</small>
          <button class="admin-action-btn view" style="margin-top:6px" onclick="viewItem('${m.lostItem?._id||''}')">View</button>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <strong style="font-size:20px">${m.score}</strong>
            <span class="match-badge match-${(m.label||'').toLowerCase()}">${m.label||'—'}</span>
          </div>
          ${confidenceBar}
          ${breakdownHTML}
        </td>
        <td>
          ${m.notificationSent
            ? `<span style="color:var(--success);font-weight:700">✅ Sent</span><br>
               <small>${m.notificationSentAt?fmtDate(m.notificationSentAt):''}</small>`
            : `<span style="color:var(--warning)">⏳ Not sent</span><br>
               <small>Sends on approval</small>`}
        </td>
        <td><small>${fmtDate(m.createdAt)}</small></td>
      </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="admin-section-info">
        ${data.total} match record${data.total!==1?'s':''} — Scores ≥80 are High confidence, 60–79 are Possible
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Found Item</th><th>Lost Item</th><th>Confidence Score</th>
            <th>Notification</th><th>Matched On</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Contributions (top contributors + full history) ────────────────────────
  else if (tab === 'contributions') {
    // Load both leaderboard and detailed history in parallel
    const [lbRes, histRes] = await Promise.all([
      apiCall('GET', '/contributions/leaderboard?filter=overall&limit=10'),
      apiCall('GET', '/admin/contributions?limit=50')
    ]);

    let leaderboardHTML = '';
    if (lbRes.ok && lbRes.data.success && lbRes.data.leaderboard.length) {
      const rows = lbRes.data.leaderboard.map(u => {
        const rankIcon = u.rank===1?'🥇':u.rank===2?'🥈':u.rank===3?'🥉':`#${u.rank}`;
        const emoji = {'Starter Badge':'🏅','Bronze Badge':'🥉','Silver Badge':'🥈','Gold Badge':'🥇','Platinum Badge':'💎'}[u.contributionBadge]||'🏅';
        return `<tr class="${u.rank<=3?'lb-top':''}">
          <td class="lb-rank">${rankIcon}</td>
          <td><strong>${escHtml(u.name)}</strong><br><small>${escHtml(u.section||'—')}</small></td>
          <td><span class="badge-pill" style="background:${u.contributionBadgeColor}20;color:${u.contributionBadgeColor}">${emoji} ${escHtml(u.contributionBadge||'')}</span></td>
          <td class="pts-cell">${u.totalPoints}</td>
          <td>${u.successfullyReturnedItems}</td>
        </tr>`;
      }).join('');
      leaderboardHTML = `
        <h3 style="font-size:16px;margin-bottom:14px;font-weight:800">🏆 Top Contributors</h3>
        <div class="admin-table-wrap" style="margin-bottom:32px">
          <table class="admin-table">
            <thead><tr><th>Rank</th><th>Student</th><th>Badge</th><th>Total Points</th><th>Items Returned</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    let historyHTML = '';
    if (histRes.ok && histRes.data.success && histRes.data.history.length) {
      const rows = histRes.data.history.map(h => `<tr>
        <td>
          <strong>${escHtml(h.user?.name||'—')}</strong><br>
          <small>${escHtml(h.user?.email||'')}</small><br>
          <small>${escHtml(h.user?.section||'')}</small>
        </td>
        <td>
          ${escHtml(h.item?.title||'—')}<br>
          <span class="status-pill status-pill-${h.item?.type||'found'}" style="font-size:8px">${h.item?.type||''}</span>
        </td>
        <td>
          <span class="admin-action-label ${h.action==='ITEM_RETURNED'?'action-returned':'action-approved'}">
            ${h.action==='ITEM_RETURNED'?'🏆 Item Returned':'✅ Report Approved'}
          </span>
        </td>
        <td class="pts-cell">+${h.points}</td>
        <td><strong>${h.user?.contributionPoints||0}</strong> total<br><small>${escHtml(h.user?.contributionLevel||'')}</small></td>
        <td>${fmtDate(h.createdAt)}</td>
      </tr>`).join('');
      historyHTML = `
        <h3 style="font-size:16px;margin-bottom:14px;font-weight:800">📋 Full Points History</h3>
        <div class="admin-section-info" style="margin-bottom:12px">
          ${histRes.data.total} award record${histRes.data.total!==1?'s':''}. Points are awarded automatically by the backend — not editable.
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Student</th><th>Item</th><th>Action</th><th>Points</th><th>Running Total</th><th>Date</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } else {
      historyHTML = `<div class="admin-empty-state"><span>⭐</span><p>No contribution records yet.</p></div>`;
    }

    content.innerHTML = leaderboardHTML + historyHTML;
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  else if (tab === 'users') {
    const { ok, data } = await apiCall('GET', '/admin/users?limit=50');
    if (!ok || !data.success) { content.innerHTML = adminErr('users'); return; }

    const rows = data.users.map(u => {
      const emoji = {'Starter Badge':'🏅','Bronze Badge':'🥉','Silver Badge':'🥈','Gold Badge':'🥇','Platinum Badge':'💎'}[u.contributionBadge]||'🏅';
      return `<tr>
        <td><strong>${escHtml(u.name)}</strong><br><small>${escHtml(u.section||'')}</small></td>
        <td><small>${escHtml(u.email)}</small></td>
        <td>${u.role}</td>
        <td>
          <span class="pts-cell">${u.contributionPoints}</span><br>
          <small>${emoji} ${escHtml(u.contributionLevel)}</small>
        </td>
        <td>
          <span title="Found reports">${u.totalFoundReports} found</span><br>
          <span title="Verified reports" style="color:var(--success)">${u.verifiedFoundReports} verified</span><br>
          <span title="Returned" style="color:var(--primary)">${u.successfullyReturnedItems} returned</span>
        </td>
        <td>${fmtDate(u.createdAt)}</td>
        <td>
          ${u.isSuspended
            ? `<span style="color:var(--danger)">Suspended</span>
               <button class="admin-action-btn approve" onclick="adminToggleSuspend('${u._id}',false)">Unsuspend</button>`
            : `<span style="color:var(--success)">Active</span>
               <button class="admin-action-btn reject"  onclick="adminToggleSuspend('${u._id}',true)">Suspend</button>`}
        </td>
      </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="admin-section-info">${data.total} registered student${data.total!==1?'s':''}. Points are set only by the backend reward system.</div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Name</th><th>Email</th><th>Role</th><th>Points & Level</th>
            <th>Activity</th><th>Joined</th><th>Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Monthly Rewards ────────────────────────────────────────────────────────
  else if (tab === 'rewards') {
    await loadAdminRewardsTab(content);
  }
}

function adminItemCard(item) {
  const colorClass = { electronics:'purple', bags:'blue', documents:'yellow',
                        accessories:'pink', clothing:'green', other:'orange' }[item.category] || 'purple';
  const emoji = { electronics:'📱', bags:'🎒', documents:'🪪',
                   accessories:'⌚', clothing:'👕', other:'📦' }[item.category] || '📦';
  return `<div class="admin-item-card">
    <div class="item-image ${colorClass}" style="height:120px">
      ${item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${escHtml(item.title)}" style="width:100%;height:100%;object-fit:cover">`
        : `<div class="image-placeholder" style="font-size:40px">${emoji}</div>`}
      <span class="status ${item.type}">${item.type.toUpperCase()}</span>
    </div>
    <div class="admin-item-body">
      <strong>${escHtml(item.title)}</strong>
      <p>📍 ${escHtml(item.location)}</p>
      <p>By: ${escHtml(item.reportedBy?.name||'Unknown')}</p>
      <p class="date">${fmtDate(item.createdAt)}</p>
      <span class="status-pill status-pill-${item.status}">${item.status}</span>
      <div class="admin-item-actions">
        <button class="admin-action-btn view"    onclick="viewItem('${item._id}')">View</button>
        <button class="admin-action-btn approve" onclick="openAdminStatus('${item._id}','${escHtml(item.title)}')">Update Status</button>
      </div>
    </div>
  </div>`;
}

function openAdminStatus(itemId, title) {
  document.getElementById('adminStatusItemId').value    = itemId;
  document.getElementById('adminStatusTitle').textContent = `Update: ${title}`;
  document.getElementById('adminStatusMsg').textContent  = '';
  openModal('adminStatusModal');
}

async function submitAdminStatus(e) {
  e.preventDefault();
  const id     = document.getElementById('adminStatusItemId').value;
  const status = document.getElementById('adminStatusSelect').value;
  const note   = document.getElementById('adminStatusNote').value;

  const { ok, data } = await apiCall('PATCH', `/admin/items/${id}/status`, { status, adminNote: note });
  if (ok && data.success) {
    showToast(`Item ${status} successfully`, 'success');
    closeModal('adminStatusModal');
    loadAdminStats();
    loadAdminTab(currentAdminTab);
  } else {
    document.getElementById('adminStatusMsg').textContent = data.message || 'Update failed';
    document.getElementById('adminStatusMsg').className   = 'form-msg error';
  }
}

async function adminUpdateClaim(claimId, status) {
  const { ok, data } = await apiCall('PATCH', `/admin/claims/${claimId}`, { status });
  if (ok && data.success) {
    showToast(`Claim ${status}`, 'success');
    loadAdminTab('claims');
    loadAdminStats();
  } else {
    showToast(data.message || 'Failed', 'error');
  }
}

async function adminUpdateClaimWithNote(claimId) {
  const reason = prompt('Reason for rejection (shown to student):');
  if (reason === null) return; // cancelled
  const { ok, data } = await apiCall('PATCH', `/admin/claims/${claimId}`, {
    status: 'rejected', adminNote: reason.trim()
  });
  if (ok && data.success) {
    showToast('Claim rejected', 'success');
    loadAdminTab('claims');
    loadAdminStats();
  } else {
    showToast(data.message || 'Failed', 'error');
  }
}

function adminFilterClaims(status, btn) {
  document.querySelectorAll('#adminTabContent .filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const rows = document.querySelectorAll('#claimsTable tbody tr');
  rows.forEach(row => {
    const rowStatus = row.getAttribute('data-claim-status');
    row.style.display = (status === 'all' || rowStatus === status) ? '' : 'none';
  });
}

function adminErr(section) {
  return `<div class="admin-empty-state"><span>⚠️</span><p>Could not load ${section}. Check server connection.</p></div>`;
}

async function adminToggleSuspend(userId, suspend) {
  const { ok, data } = await apiCall('PATCH', `/admin/users/${userId}/suspend`, { isSuspended: suspend });
  if (ok && data.success) {
    showToast(suspend ? 'User suspended' : 'User unsuspended', 'success');
    loadAdminTab('users');
  } else {
    showToast(data.message || 'Failed', 'error');
  }
}

// ── Campus Map ────────────────────────────────────────────────────────────────
let selectedMapLocation = '';

function populateLocationSelects() {
  const selects = ['lostLocation','foundLocation','mapLocation'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    CAMPUS_LOCATIONS.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc; opt.textContent = loc;
      sel.appendChild(opt);
    });
  });
}

function setTodayDates() {
  const today = new Date().toISOString().split('T')[0];
  ['lostDate','foundDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = today; el.max = today; }
  });
}

function selectMapLocation(event) {
  const map  = document.getElementById('campusMapImage');
  const rect = map.getBoundingClientRect();
  const xPct = ((event.clientX - rect.left) / rect.width  ) * 100;
  const yPct = ((event.clientY - rect.top ) / rect.height ) * 100;

  // Find the nearest location by Euclidean distance in percent-space
  let nearest = null;
  let minDist = Infinity;
  for (const [name, coords] of Object.entries(LOCATION_COORDS)) {
    const dx   = xPct - coords.x;
    const dy   = yPct - coords.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) { minDist = dist; nearest = name; }
  }

  selectedMapLocation = nearest;
  placeMarker(xPct, yPct, nearest);
  showLocationResults(nearest);

  // Snap the dropdown to the matched location
  document.getElementById('mapLocation').value = nearest;
}

function locateItem(location) {
  selectedMapLocation = location;
  document.getElementById('campus-map').scrollIntoView({ behavior: 'smooth' });

  const coords = LOCATION_COORDS[location];
  if (coords) {
    placeMarker(coords.x, coords.y, location);
  } else {
    // Fallback: center of map
    placeMarker(50, 50, location);
  }
  document.getElementById('mapLocation').value = location;
  showLocationResults(location);
}

function locateFromSelect() {
  const loc = document.getElementById('mapLocation').value;
  if (loc) locateItem(loc);
}

function locateSelectedLocation() {
  const loc = document.getElementById('mapLocation').value;
  if (loc) locateItem(loc);
  else showToast('Please select a location first', 'info');
}

function placeMarker(xPct, yPct, label) {
  const marker = document.getElementById('mapMarker');
  marker.style.display = 'flex';
  marker.style.left    = xPct + '%';
  marker.style.top     = yPct + '%';
  document.getElementById('markerTitle').textContent = label;
  document.getElementById('mapInstruction').style.display = 'none';

  const locBox = document.getElementById('selectedLocation');
  const coords = LOCATION_COORDS[label];
  const subtitle = coords ? `${xPct.toFixed(1)}% × ${yPct.toFixed(1)}%` : 'Selected location';
  locBox.innerHTML = `
    <span>📍</span>
    <div>
      <strong>${escHtml(label)}</strong>
      <small>Pinned on campus map</small>
    </div>`;
}

function clearMarker() {
  const marker = document.getElementById('mapMarker');
  marker.style.display = 'none';
  selectedMapLocation  = '';
  document.getElementById('mapInstruction').style.display = '';
  document.getElementById('mapLocation').value = '';
  document.getElementById('selectedLocation').innerHTML =
    '<span>📍</span><div><strong>No location selected</strong><small>Click the map or select a campus location.</small></div>';
  document.getElementById('exactLocationItems').innerHTML = '<div class="no-items">No location selected yet.</div>';
  document.getElementById('nearbyLocationItems').innerHTML = '<div class="no-items">Select a location to see nearby items.</div>';
}

async function showLocationResults(location) {
  document.getElementById('resultsTitle').textContent       = `Results for: ${location}`;
  document.getElementById('resultsDescription').textContent = `Lost and found items at or near ${location}.`;

  const exactEl  = document.getElementById('exactLocationItems');
  const nearbyEl = document.getElementById('nearbyLocationItems');
  exactEl.innerHTML  = '<div class="no-items">Loading…</div>';
  nearbyEl.innerHTML = '<div class="no-items">Loading…</div>';

  const { ok, data } = await apiCall('GET', `/items?location=${encodeURIComponent(location)}&limit=20`);
  if (!ok || !data.success) return;

  const exact  = data.items.filter(i => i.location === location);
  const nearby = data.items.filter(i => i.location !== location);

  exactEl.innerHTML  = exact.length  ? exact.map(i => locationItemHTML(i, false)).join('') : '<div class="no-items">No items at this exact location.</div>';
  nearbyEl.innerHTML = nearby.length ? nearby.map(i => locationItemHTML(i, true)).join('') : '<div class="no-items">No nearby items found.</div>';
}

function locationItemHTML(item, isNearby) {
  const emoji = { electronics:'📱', bags:'🎒', documents:'🪪',
                   accessories:'⌚', clothing:'👕', other:'📦' }[item.category] || '📦';
  return `<div class="location-item" onclick="viewItem('${item._id}')">
    <div class="location-item-icon">
      ${item.imageUrl ? `<img src="${item.imageUrl}" alt="">` : emoji}
    </div>
    <div class="location-item-info">
      <strong>${escHtml(item.title)}</strong>
      <span>📍 ${escHtml(item.location)}</span>
      <span class="location-status ${item.type}">${item.type.toUpperCase()}</span>
      ${isNearby ? '<span class="nearby-badge">NEARBY</span>' : ''}
    </div>
  </div>`;
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// ── Dropdowns ─────────────────────────────────────────────────────────────────
function toggleUserMenu() {
  userMenuOpen = !userMenuOpen;
  document.getElementById('userDropdown').classList.toggle('open', userMenuOpen);
}

function closeUserMenu() {
  userMenuOpen = false;
  document.getElementById('userDropdown').classList.remove('open');
}

function toggleMobileMenu() {
  mobileMenuOpen = !mobileMenuOpen;
  document.getElementById('mobileNav').classList.toggle('open', mobileMenuOpen);
}

function handleOutsideClick(e) {
  // Close notification dropdown
  const bell = document.getElementById('notifBellWrap');
  if (notifDropdownOpen && bell && !bell.contains(e.target)) {
    notifDropdownOpen = false;
    document.getElementById('notifDropdown').classList.remove('open');
  }
  // Close user menu
  const userWrap = document.getElementById('userMenuWrap');
  if (userMenuOpen && userWrap && !userWrap.contains(e.target)) {
    closeUserMenu();
  }
}

// ── Image preview ─────────────────────────────────────────────────────────────
function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent  = message;
  toast.className    = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m} minute${m>1?'s':''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} hour${h>1?'s':''} ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d} day${d>1?'s':''} ago`;
  return new Date(dateStr).toLocaleDateString();
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function setFormState(btnId, msgId, loading, errorMsg) {
  const btn = document.getElementById(btnId);
  const msg = document.getElementById(msgId);
  if (btn) { btn.disabled = loading; if (loading) btn.textContent = 'Please wait…'; }
  if (msg) {
    msg.textContent = errorMsg;
    msg.className   = errorMsg ? 'form-msg error' : 'form-msg';
    if (!loading && !errorMsg) {
      // restore original text
      const origTexts = {
        loginBtn:'Log in', registerBtn:'Create Account',
        lostSubmitBtn:'Submit Lost Report', foundSubmitBtn:'Submit Found Report'
      };
      if (btn && origTexts[btnId]) btn.textContent = origTexts[btnId];
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 1: MY ACTIVITY PAGE
// ═══════════════════════════════════════════════════════════════════════════

let activityPage     = 1;
let activityTotal    = 0;
let activityTabType  = 'all';
let actSearchTimer   = null;

// ── Load summary cards ────────────────────────────────────────────────────────
async function loadActivitySummary() {
  const { ok, data } = await apiCall('GET', '/activities/me/summary');
  if (!ok || !data.success) return;
  const s = data.summary;
  document.getElementById('actSumLost').textContent    = s.totalLostReports    || 0;
  document.getElementById('actSumFound').textContent   = s.totalFoundReports   || 0;
  document.getElementById('actSumClaims').textContent  = s.totalClaimsSubmitted|| 0;
  document.getElementById('actSumReturned').textContent= s.totalReturned       || 0;
  document.getElementById('actSumPoints').textContent  = s.totalPointsEarned   || 0;
}

// ── Load paginated activity list ──────────────────────────────────────────────
async function loadActivityPage() {
  const list = document.getElementById('activityList');
  list.innerHTML = '<div class="items-loading"><div class="spinner"></div></div>';

  const search   = document.getElementById('actSearch').value.trim();
  const dateFrom = document.getElementById('actDateFrom').value;
  const dateTo   = document.getElementById('actDateTo').value;
  const sort     = document.getElementById('actSort').value;

  const qs = new URLSearchParams({
    page:  activityPage,
    limit: 15,
    type:  activityTabType,
    sort
  });
  if (search)   qs.set('search',   search);
  if (dateFrom) qs.set('dateFrom', dateFrom);
  if (dateTo)   qs.set('dateTo',   dateTo);

  const { ok, data } = await apiCall('GET', `/activities/me?${qs}`);
  if (!ok || !data.success) {
    list.innerHTML = '<p class="empty-state" style="display:block">Could not load activities.</p>';
    return;
  }

  activityTotal = data.total || 0;
  const activities = data.activities || [];

  if (!activities.length) {
    list.innerHTML = `<div class="act-empty"><span>📭</span><p>No activities found.</p></div>`;
    document.getElementById('actPaginationRow').style.display = 'none';
    return;
  }

  list.innerHTML = activities.map(a => activityItemHTML(a)).join('');
  renderActivityPagination(data.totalPages || 1);
  loadActivitySummary();
}

function activityItemHTML(a) {
  const icons = {
    ITEM_REPORTED:   a.meta?.itemType === 'found' ? '🤝' : '🔍',
    ITEM_APPROVED:   '✅',
    ITEM_REJECTED:   '❌',
    ITEM_RETURNED:   '🏆',
    CLAIM_SUBMITTED: '📋',
    CLAIM_APPROVED:  '🎉',
    CLAIM_REJECTED:  '⛔',
    POINTS_EARNED:   '⭐',
    MONTHLY_WINNER:  '🥇',
    REWARD_ISSUED:   '🎁'
  };
  const colors = {
    ITEM_APPROVED:  'act-green',  ITEM_RETURNED:  'act-green',
    CLAIM_APPROVED: 'act-green',  POINTS_EARNED:  'act-purple',
    MONTHLY_WINNER: 'act-gold',   REWARD_ISSUED:  'act-gold',
    ITEM_REJECTED:  'act-red',    CLAIM_REJECTED: 'act-red'
  };

  const icon    = icons[a.type]  || '📌';
  const colCls  = colors[a.type] || '';
  const imgHTML = a.relatedItem?.imageUrl
    ? `<img class="act-item-thumb" src="${a.relatedItem.imageUrl}" alt="">`
    : '';
  const metaItems = [
    a.meta?.itemLocation && `📍 ${escHtml(a.meta.itemLocation)}`,
    a.meta?.points       && `+${a.meta.points} pts`,
    a.meta?.claimStatus  && `Claim: ${a.meta.claimStatus}`,
    a.meta?.adminNote    && `Note: ${escHtml(a.meta.adminNote)}`
  ].filter(Boolean);

  return `<div class="act-item ${colCls}">
    <div class="act-icon">${icon}</div>
    <div class="act-body">
      <div class="act-title">${escHtml(a.title)}</div>
      <div class="act-desc">${escHtml(a.description)}</div>
      ${metaItems.length ? `<div class="act-meta">${metaItems.map(m=>`<span>${m}</span>`).join('')}</div>` : ''}
      ${imgHTML}
      <div class="act-time">${timeAgo(a.createdAt)}</div>
    </div>
    ${a.relatedItem?._id ? `<button class="act-view-btn outline-btn" onclick="viewItem('${a.relatedItem._id}')">View →</button>` : ''}
  </div>`;
}

function renderActivityPagination(totalPages) {
  const row = document.getElementById('actPaginationRow');
  if (totalPages <= 1) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  document.getElementById('actPageInfo').textContent = `Page ${activityPage} of ${totalPages}`;
  document.getElementById('actPrevBtn').disabled = activityPage <= 1;
  document.getElementById('actNextBtn').disabled = activityPage >= totalPages;
}

function changeActivityPage(dir) {
  activityPage += dir;
  if (activityPage < 1) activityPage = 1;
  loadActivityPage();
  document.getElementById('page-activity').scrollIntoView({ behavior: 'smooth' });
}

function setActivityTab(type, btn) {
  activityTabType = type;
  activityPage    = 1;
  document.querySelectorAll('#actTabs .filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadActivityPage();
}

function debounceActivitySearch() {
  clearTimeout(actSearchTimer);
  actSearchTimer = setTimeout(() => { activityPage = 1; loadActivityPage(); }, 400);
}


// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 2: MONTHLY REWARDS PAGE
// ═══════════════════════════════════════════════════════════════════════════

let countdownInterval = null;

async function loadMonthlyRewardsPage() {
  // Clear any old countdown
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

  // Fetch live leaderboard (current month)
  const { ok, data } = await apiCall('GET', '/rewards/leaderboard');
  if (ok && data.success) {
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    document.getElementById('rewardMonthLabel').textContent =
      `${months[data.month - 1]} ${data.year}`;

    // Countdown
    startCountdown(data.secondsLeft);

    // Leaderboard table
    const tbody = document.getElementById('monthlyLbBody');
    if (!data.leaderboard.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">No contributions this month yet.</td></tr>';
    } else {
      tbody.innerHTML = data.leaderboard.map(u => {
        const rankIcon = u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : `#${u.rank}`;
        const isMine   = currentUser && u.userId === currentUser._id;
        return `<tr class="${u.rank <= 3 ? 'lb-top' : ''} ${isMine ? 'lb-mine' : ''}">
          <td class="lb-rank">${rankIcon}</td>
          <td class="lb-name">${escHtml(u.name)}${isMine ? ' <span class="you-badge">YOU</span>' : ''}</td>
          <td class="lb-section">${escHtml(u.section || '—')}</td>
          <td class="lb-pts"><strong>${u.monthlyPoints}</strong></td>
          <td class="lb-ret">${u.returns}</td>
        </tr>`;
      }).join('');
    }
  }

  // My rank card
  if (currentUser) {
    const rankEl = document.getElementById('myRankCard');
    rankEl.style.display = 'flex';
    const { ok: rOk, data: rData } = await apiCall('GET', '/rewards/my-rank');
    if (rOk && rData.success) {
      document.getElementById('myCurrentRank').textContent =
        rData.rank ? `#${rData.rank}` : '–';
      document.getElementById('myMonthlyPts').textContent = rData.monthlyPoints || 0;
    }

    // My rewards
    document.getElementById('myRewardsSection').style.display = 'block';
    await loadMyRewards();
  }

  // Past winners
  await loadPastWinners();
}

function startCountdown(seconds) {
  const el = document.getElementById('countdownText');
  let remaining = seconds;

  function tick() {
    if (remaining <= 0) {
      el.textContent = 'Month ended';
      clearInterval(countdownInterval);
      return;
    }
    const d = Math.floor(remaining / 86400);
    const h = Math.floor((remaining % 86400) / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    el.textContent = d > 0
      ? `${d}d ${h}h ${m}m`
      : `${h}h ${m}m ${s}s`;
    remaining--;
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

async function loadMyRewards() {
  const list  = document.getElementById('myRewardsList');
  const empty = document.getElementById('myRewardsEmpty');
  list.innerHTML = '<div class="items-loading"><div class="spinner"></div></div>';

  const { ok, data } = await apiCall('GET', '/rewards/my-rewards');
  if (!ok || !data.success) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  const rewards = data.rewards || [];
  if (!rewards.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = rewards.map(r => rewardCardHTML(r, true)).join('');
}

async function loadPastWinners() {
  const list  = document.getElementById('pastWinnersList');
  const empty = document.getElementById('pastWinnersEmpty');
  list.innerHTML = '<div class="items-loading"><div class="spinner"></div></div>';

  const { ok, data } = await apiCall('GET', '/rewards/monthly-winners?limit=12');
  if (!ok || !data.success || !data.winners.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = data.winners.map(w => pastWinnerCardHTML(w)).join('');
}

function rewardCardHTML(r, showCoupon = false) {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const statusClass = { issued:'rw-issued', redeemed:'rw-redeemed', expired:'rw-expired',
                         confirmed:'rw-confirmed', pending_review:'rw-pending' }[r.status] || '';
  const statusLabel = { issued:'Issued ✓', redeemed:'Redeemed', expired:'Expired',
                         confirmed:'Confirmed', pending_review:'Pending Review' }[r.status] || r.status;

  const couponHTML = showCoupon && r.couponCode && r.status === 'issued'
    ? `<div class="coupon-box">
         <div class="coupon-label">🎟 Your Coupon Code</div>
         <div class="coupon-code">${escHtml(r.couponCode)}</div>
         ${r.expiryDate ? `<div class="coupon-expiry">Expires: ${fmtDate(r.expiryDate)}</div>` : ''}
       </div>`
    : '';

  return `<div class="reward-card ${statusClass}">
    <div class="reward-card-top">
      <div class="reward-card-icon">🏆</div>
      <div class="reward-card-info">
        <strong>${escHtml(r.rewardTitle || 'Monthly Finder Champion Reward')}</strong>
        <span>${months[r.month - 1]} ${r.year}</span>
      </div>
      <span class="reward-status-pill">${statusLabel}</span>
    </div>
    <div class="reward-card-stats">
      <span>${r.monthlyPoints} monthly pts</span>
      <span>•</span>
      <span>${r.successfulReturns} returns</span>
      ${r.rewardValue ? `<span>•</span><span>₹${r.rewardValue} value</span>` : ''}
    </div>
    ${r.rewardDescription ? `<p class="reward-card-desc">${escHtml(r.rewardDescription)}</p>` : ''}
    ${couponHTML}
    ${r.issuedAt ? `<div class="reward-card-date">Issued: ${fmtDate(r.issuedAt)}</div>` : ''}
  </div>`;
}

function pastWinnerCardHTML(w) {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `<div class="past-winner-card">
    <div class="pw-rank">🏆</div>
    <div class="pw-body">
      <strong>${escHtml(w.winnerName || 'Anonymous')}</strong>
      <span>${escHtml(w.winnerSection || '')}</span>
      <span class="pw-month">${months[w.month - 1]} ${w.year}</span>
    </div>
    <div class="pw-pts">
      <strong>${w.monthlyPoints}</strong>
      <span>pts</span>
    </div>
  </div>`;
}


// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: MONTHLY REWARDS TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadAdminRewardsTab(content) {
  const { ok, data } = await apiCall('GET', '/admin/rewards?limit=30');
  if (!ok || !data.success) {
    content.innerHTML = '<p class="empty-state" style="display:block">Failed to load rewards.</p>';
    return;
  }

  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  const triggerForm = `
    <div class="admin-trigger-box">
      <strong>Manually calculate a month's champion</strong>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
        <select id="triggerMonth" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px">
          ${months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}
        </select>
        <input type="number" id="triggerYear" value="${new Date().getFullYear()}"
          style="width:100px;padding:8px 12px;border:1px solid var(--border);border-radius:8px">
        <button class="primary-btn small" onclick="adminTriggerMonth()">Calculate</button>
      </div>
      <p class="form-msg" id="triggerMsg" style="margin-top:8px"></p>
    </div>`;

  if (!data.rewards.length) {
    content.innerHTML = triggerForm + '<p class="empty-state" style="display:block;margin-top:20px">No monthly reward records yet.</p>';
    return;
  }

  const rows = data.rewards.map(r => {
    const statusPill = `<span class="status-pill status-pill-${r.status.replace('_','-')}">${r.status.replace('_',' ')}</span>`;
    const actions = [];

    if (r.status === 'pending_review') {
      actions.push(`<button class="admin-action-btn approve" onclick="adminConfirmWinner('${r._id}')">Confirm Winner</button>`);
    }
    if (r.status === 'confirmed') {
      actions.push(`<button class="admin-action-btn approve" onclick="openAdminRewardModal('${r._id}','issue')">Issue Coupon</button>`);
    }
    if (r.status === 'issued') {
      actions.push(`<button class="admin-action-btn view"   onclick="adminMarkRewardRedeemed('${r._id}')">Mark Redeemed</button>`);
      actions.push(`<button class="admin-action-btn reject" onclick="adminMarkRewardExpired('${r._id}')">Expire</button>`);
    }

    return `<tr>
      <td><strong>${months[r.month - 1]} ${r.year}</strong></td>
      <td>${escHtml(r.winner?.name || r.winnerName || '—')}<br><small>${escHtml(r.winner?.section || r.winnerSection || '')}</small></td>
      <td class="pts-cell">${r.monthlyPoints}</td>
      <td>${r.successfulReturns}</td>
      <td>${statusPill}</td>
      <td>${r.couponCode ? `<code style="font-size:11px">${escHtml(r.couponCode)}</code>` : '—'}</td>
      <td>${actions.join(' ')}</td>
    </tr>`;
  }).join('');

  content.innerHTML = triggerForm + `
    <div class="admin-table-wrap" style="margin-top:20px">
      <table class="admin-table">
        <thead><tr>
          <th>Month</th><th>Winner</th><th>Monthly Pts</th>
          <th>Returns</th><th>Status</th><th>Coupon</th><th>Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function adminTriggerMonth() {
  const month = document.getElementById('triggerMonth').value;
  const year  = document.getElementById('triggerYear').value;
  const msg   = document.getElementById('triggerMsg');
  msg.textContent = 'Calculating…';
  msg.className   = 'form-msg';

  const { ok, data } = await apiCall('POST', '/admin/rewards/trigger', {
    month: parseInt(month), year: parseInt(year)
  });

  msg.textContent = data.message || (ok ? 'Done' : 'Failed');
  msg.className   = ok ? 'form-msg success' : 'form-msg error';

  if (ok) {
    setTimeout(() => loadAdminTab('rewards'), 800);
    loadAdminStats();
  }
}

async function adminConfirmWinner(rewardId) {
  if (!confirm('Confirm this winner? This will record their monthly win.')) return;
  const { ok, data } = await apiCall('PATCH', `/admin/rewards/${rewardId}/confirm`, {});
  showToast(data.message || (ok ? 'Winner confirmed' : 'Failed'), ok ? 'success' : 'error');
  if (ok) { loadAdminTab('rewards'); loadAdminStats(); }
}

function openAdminRewardModal(rewardId, action) {
  document.getElementById('adminRewardId').value     = rewardId;
  document.getElementById('adminRewardAction').value = action;
  document.getElementById('adminRewardMsg').textContent = '';
  openModal('adminRewardModal');
}

async function submitAdminReward(e) {
  e.preventDefault();
  const id     = document.getElementById('adminRewardId').value;
  const action = document.getElementById('adminRewardAction').value;
  const payload = {
    couponCode:        document.getElementById('adminCouponCode').value.trim(),
    rewardTitle:       document.getElementById('adminRewardTitleInput').value.trim(),
    rewardDescription: document.getElementById('adminRewardDesc').value.trim(),
    rewardValue:       parseInt(document.getElementById('adminRewardValue').value, 10),
    expiryDate:        document.getElementById('adminRewardExpiry').value || null,
    adminNote:         document.getElementById('adminRewardNote').value.trim()
  };

  const { ok, data } = await apiCall('PATCH', `/admin/rewards/${id}/${action}`, payload);
  if (ok && data.success) {
    showToast('Coupon issued successfully!', 'success');
    closeModal('adminRewardModal');
    loadAdminTab('rewards');
    loadAdminStats();
  } else {
    document.getElementById('adminRewardMsg').textContent = data.message || 'Failed';
    document.getElementById('adminRewardMsg').className   = 'form-msg error';
  }
}

async function adminMarkRewardRedeemed(rewardId) {
  if (!confirm('Mark this coupon as redeemed?')) return;
  const { ok, data } = await apiCall('PATCH', `/admin/rewards/${rewardId}/redeem`, {});
  showToast(data.message || (ok ? 'Marked redeemed' : 'Failed'), ok ? 'success' : 'error');
  if (ok) loadAdminTab('rewards');
}

async function adminMarkRewardExpired(rewardId) {
  if (!confirm('Mark this reward as expired?')) return;
  const { ok, data } = await apiCall('PATCH', `/admin/rewards/${rewardId}/expire`, {});
  showToast(data.message || (ok ? 'Marked expired' : 'Failed'), ok ? 'success' : 'error');
  if (ok) loadAdminTab('rewards');
}
