// ─── GLOBAL CONFIG ───────────────────────────────────────────────────────────
const API_URL = 'http://localhost:5000/api';

// ─── PROFILE UI (eski sayfalar için) ─────────────────────────────────────────
function updateProfileUI() {
  const username = localStorage.getItem('username');
  if (document.getElementById('display-username')) {
    document.getElementById('display-username').innerText = `@${username}`;
  }
  if (document.getElementById('user-pp')) {
    document.getElementById('user-pp').src = `https://ui-avatars.com/api/?name=${username}&background=6f42c1&color=fff`;
  }
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
async function handleRegister() {
  const username = document.getElementById('username').value;
  const email    = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const res  = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await res.json();
  if (res.ok) {
    alert('Registration successful! You can now log in.');
  } else {
    alert('Registration failed: ' + (data.message || 'Unknown error'));
  }
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const res  = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (res.ok) {
    localStorage.setItem('token',    data.token);
    localStorage.setItem('username', data.user.username);
    localStorage.setItem('userId',   data.user.id);
    localStorage.setItem('userAvatar', data.user.avatar_url || '');
    window.location.href = 'home.html';
  } else {
    alert('Login failed: ' + (data.message || 'Wrong credentials'));
  }
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
// home.html ve profile.html kendi handleLogout'larını tanımlıyor.
// Bu sadece index.html gibi başka sayfalar için fallback.
function handleLogout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

// ─── LOAD USER THREADS (profile.html eski versiyon için) ─────────────────────
async function loadUserThreads(username) {
  const listDiv = document.getElementById('user-threads-list');
  if (!listDiv) return;
  try {
    const res         = await fetch(`${API_URL}/threads`);
    const allThreads  = await res.json();
    const userThreads = allThreads.filter(t => t.username === username);

    listDiv.innerHTML = userThreads.length
      ? ''
      : '<p style="color:#888;">No threads posted yet.</p>';

    for (const t of userThreads) {
      const cRes     = await fetch(`${API_URL}/comments/${t.id}`);
      const comments = await cRes.json();
      listDiv.innerHTML += `
        <div class="thread-item">
          <strong>${t.title}</strong>
          <small>${new Date(t.created_at).toLocaleDateString()}</small>
          <p>${t.content}</p>
          <div style="margin-top:10px;font-size:12px;color:#888;">
            ${comments.length} Replies
          </div>
        </div>`;
    }
  } catch (e) {
    console.error('loadUserThreads error:', e);
  }
}

// ─── AŞAĞIDAKI FONKSİYONLAR SADECE SAYFA KENDİSİ TANIMLAMADIYSA ÇALIŞIR ─────
// Yeni home.html bunları inline tanımlıyor; app.js'tekiler çakışmaması için
// typeof kontrolüyle korunuyor.

if (typeof createThread === 'undefined') {
  window.createThread = async function () {
    const title   = document.getElementById('thread-title').value;
    const content = document.getElementById('thread-content').value;
    const userId  = localStorage.getItem('userId');

    await fetch(`${API_URL}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, userId })
    });

    document.getElementById('thread-title').value   = '';
    document.getElementById('thread-content').value = '';
    loadThreads();
  };
}

if (typeof loadThreads === 'undefined') {
  window.loadThreads = async function () {
    const listDiv = document.getElementById('threads-list');
    if (!listDiv) return;
    const res     = await fetch(`${API_URL}/threads`);
    const threads = await res.json();

    listDiv.innerHTML = '';
    for (const t of threads) {
      const cRes     = await fetch(`${API_URL}/comments/${t.id}`);
      const comments = await cRes.json();

      listDiv.innerHTML += `
        <div class="thread-item">
          <strong>${t.title}</strong>
          <small>@${t.username} • ${new Date(t.created_at).toLocaleDateString()}</small>
          <p>${t.content}</p>
          <div style="margin-left:15px;border-left:2px solid #333;padding-left:10px;">
            ${comments.map(c =>
              `<div style="font-size:12px;">
                <span style="color:#bb86fc;">@${c.username}:</span> ${c.content}
              </div>`
            ).join('')}
            <div style="display:flex;gap:5px;margin-top:5px;">
              <input type="text" id="reply-${t.id}" placeholder="Reply..."
                style="padding:4px;font-size:12px;margin:0;">
              <button onclick="postReply(${t.id})"
                style="width:auto;padding:4px 8px;font-size:11px;background:#6f42c1;">
                Reply
              </button>
            </div>
          </div>
        </div>`;
    }
  };
}

if (typeof postReply === 'undefined') {
  window.postReply = async function (threadId) {
    const content = document.getElementById(`reply-${threadId}`).value;
    const userId  = localStorage.getItem('userId');

    await fetch(`${API_URL}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, userId, content })
    });
    loadThreads();
  };
}

// ─── GLOBAL SEARCH ───────────────────────────────────────────────────────────
let _searchTimer = null;

function initSearch() {
  const input    = document.getElementById('globalSearch');
  const dropdown = document.getElementById('searchDropdown');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { dropdown.classList.remove('open'); return; }
    _searchTimer = setTimeout(() => doSearch(q), 400);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) dropdown.classList.remove('open');
  });
}

async function doSearch(q) {
  const dropdown = document.getElementById('searchDropdown');
  dropdown.innerHTML = '<div class="search-result-item" style="color:var(--text-muted);cursor:default">Searching...</div>';
  dropdown.classList.add('open');

  try {
    const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();

    if (!data.threads.length && !data.users.length) {
      dropdown.innerHTML = '<div class="search-result-item" style="color:var(--text-muted);cursor:default">No results found.</div>';
      return;
    }

    let html = '';

    if (data.threads.length) {
      html += `<div class="search-result-item section-header">💬 Threads</div>`;
      data.threads.forEach(t => {
        const av = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.username||'U')}&background=1a6fd4&color=fff&size=48`;
        html += `
          <div class="search-result-item" onclick="location.href='thread.html?id=${t.id}'">
            <img class="search-mini-av" src="${av}" alt="">
            <div style="min-width:0;">
              <div class="search-result-title">${escHtml(t.title)}</div>
              <div class="search-result-meta">@${escHtml(t.username)}</div>
            </div>
          </div>`;
      });
    }

    if (data.users.length) {
      html += `<div class="search-result-item section-header">👤 Users</div>`;
      data.users.forEach(u => {
        const av = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username||'U')}&background=161c2a&color=4db8ff&size=48`;
        html += `
          <div class="search-result-item" onclick="location.href='profile.html?userId=${u.id}'">
            <img class="search-mini-av" src="${escHtml(av)}" alt="">
            <div>
              <div class="search-result-title">@${escHtml(u.username)}</div>
              <div class="search-result-meta">View profile</div>
            </div>
          </div>`;
      });
    }

    dropdown.innerHTML = html;
  } catch {
    dropdown.innerHTML = '<div class="search-result-item" style="color:var(--red);cursor:default">Search failed.</div>';
  }
}

// ─── TIME AGO (shared across all pages) ──────────────────────────────────────
function parseDateSafely(d) {
  if (!d) return new Date();
  if (d instanceof Date) return isNaN(d.getTime()) ? new Date() : d;
  let dStr = String(d);
  if (dStr.endsWith('Z') || dStr.includes('+') || dStr.includes('GMT')) {
    const parsed = new Date(dStr);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  dStr = dStr.replace(' ', 'T');
  if (!dStr.includes('T')) dStr += 'T00:00:00';
  if (!dStr.endsWith('Z')) dStr += 'Z';
  const parsedZ = new Date(dStr);
  return isNaN(parsedZ.getTime()) ? new Date(d) : parsedZ;
}

function timeAgo(d) {
  if (!d) return '';
  const date = parseDateSafely(d);
  if (isNaN(date.getTime())) return '';

  const now       = new Date();
  const diffMs    = now - date;
  const diffMins  = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1 && diffMs >= 0) return 'just now';
  if (diffMins < 60 && diffMs >= 0) return `${diffMins}m ago`;

  // Use saved timezone from settings, fallback to browser timezone
  const userTZ     = localStorage.getItem('fc_pref_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  const userLocale = navigator.language || undefined;

  if (diffHours < 24 && diffMs >= 0) {
    return new Intl.DateTimeFormat(userLocale, {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTZ
    }).format(date);
  }

  const today      = new Date(now.toLocaleString('en-US', { timeZone: userTZ }));
  const targetDate = new Date(date.toLocaleString('en-US', { timeZone: userTZ }));
  today.setHours(0,0,0,0);
  targetDate.setHours(0,0,0,0);
  const dayDiff = Math.round((today - targetDate) / 86400000);

  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7 && dayDiff > 0) return `${dayDiff} days ago`;

  return new Intl.DateTimeFormat(userLocale, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: userTZ
  }).format(date);
}

/* ============================================================
   NOTIFICATION SYSTEM — app.js'e eklenecek
   ============================================================ */

let _notifPollInterval = null;

function initNotifications() {
  const token = localStorage.getItem('token');
  if (!token) return;

  // Bell HTML'i inject et — nav'da avatar'ın yanına
  injectNotificationBell();

  // İlk yükle
  fetchUnreadCount();

  // Her 30 saniyede bir kontrol et
  _notifPollInterval = setInterval(fetchUnreadCount, 30000);
}

function injectNotificationBell() {
  // Zaten varsa tekrar ekleme
  if (document.getElementById('notif-bell-wrapper')) return;

  const bell = document.createElement('div');
  bell.id = 'notif-bell-wrapper';
  bell.innerHTML = `
    <div id="notif-bell" onclick="toggleNotifDropdown()" title="Notifications">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span id="notif-badge" class="notif-badge" style="display:none">0</span>
    </div>
    <div id="notif-dropdown" class="notif-dropdown" style="display:none">
      <div class="notif-header">
        <span>Notifications</span>
        <button onclick="markAllRead()" class="notif-mark-all">Mark all read</button>
      </div>
      <div id="notif-list" class="notif-list">
        <div class="notif-loading">Loading...</div>
      </div>
    </div>
  `;

  // Sayfada navbar/header'ı bul, bell'i ekle
  const nav = document.querySelector('.nav-user-area, .top-nav-right, .navbar-right, nav .user-section');
  if (nav) {
    nav.prepend(bell);
  } else {
    // Fallback: body'e fixed pozisyonla ekle
    bell.style.cssText = 'position:fixed;top:16px;right:80px;z-index:9999;';
    document.body.appendChild(bell);
  }

  // Dropdown dışına tıklayınca kapat
  document.addEventListener('click', (e) => {
    if (!bell.contains(e.target)) {
      const dd = document.getElementById('notif-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });
}

async function fetchUnreadCount() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    updateBadge(data.count);
  } catch {}
}

function updateBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function toggleNotifDropdown() {
  if (notifOpen) { closeNotifDropdown(); return; }
  notifOpen = true;
  document.getElementById('notif-dropdown').classList.add('open');
  await loadNotifications();
}

async function loadNotifications() {
  const token = localStorage.getItem('token');
  const list = document.getElementById('notif-list');
  if (!list) return;

  list.innerHTML = '<div class="notif-loading">Loading...</div>';

  try {
    const res = await fetch(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const notifs = await res.json();
    // notifs çekildikten sonra
    const unreadCount = notifs.filter(n => !n.read).length;
    updateBadge(unreadCount);

    list.innerHTML = notifs.map(n => buildNotifItem(n)).join('');

    if (!notifs.length) {
      list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
      return;
    }

    list.innerHTML = notifs.map(n => buildNotifItem(n)).join('');
  } catch {
    list.innerHTML = '<div class="notif-empty">Failed to load notifications</div>';
  }
}

function buildNotifItem(n) {
  const avatar = n.actor_avatar
    ? `<img src="${escHtml(n.actor_avatar)}" class="notif-avatar" onerror="this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=${escHtml(n.actor_username)}'">`
    : `<div class="notif-avatar notif-avatar-placeholder">${escHtml(n.actor_username[0].toUpperCase())}</div>`;

  const text = buildNotifText(n);
  const link = buildNotifLink(n);
  const timeStr = typeof timeAgo === 'function' ? timeAgo(n.created_at) : '';
  const unreadClass = n.read ? '' : 'notif-unread';

  return `
    <div class="notif-item ${unreadClass}" onclick="onNotifClick(${n.id}, '${link}')">
      ${avatar}
      <div class="notif-content">
        <span class="notif-text">${text}</span>
        <span class="notif-time">${timeStr}</span>
      </div>
      ${n.read ? '' : '<div class="notif-dot"></div>'}
    </div>
  `;
}

function buildNotifText(n) {
  const actor = `<strong>${escHtml(n.actor_username)}</strong>`;
  switch (n.type) {
    case 'reply':
      return `${actor} replied to the thread${n.ref_title ? `: <em>${escHtml(n.ref_title)}</em>` : ''}`;
    case 'like':
      return `${actor} liked the ${n.ref_type === 'thread' ? 'thread' : 'comment'}${n.ref_title ? `: <em>${escHtml(n.ref_title)}</em>` : ''}`;
    case 'follow':
      return `${actor} started following you`;
    case 'mention':
      return `${actor} mentioned you`;
    default:
      return `${actor} did something`;
  }
}

function buildNotifLink(n) {
  switch (n.type) {
    case 'reply':
    case 'mention':
      if (n.ref_type === 'thread') return `thread.html?id=${n.ref_id}`;
      if (n.ref_type === 'comment') return `thread.html?id=${n.comment_thread_id}#comment-${n.ref_id}`;
      return '#';
    case 'like':
      if (n.ref_type === 'thread') return `thread.html?id=${n.ref_id}`;
      if (n.ref_type === 'comment') return `thread.html?id=${n.comment_thread_id}#comment-${n.ref_id}`;
      return '#';
    case 'follow':
      return `profile.html?userId=${n.actor_id}`;
    default:
      return '#';
  }
}

async function onNotifClick(notifId, link) {
  const token = localStorage.getItem('token');
  // Read yap
  try {
    await fetch(`${API_URL}/notifications/read/${notifId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {}
  // Badge güncelle
  fetchUnreadCount();
  // Yönlendir
  if (link && link !== '#') window.location.href = link;
}

async function markAllRead() {
  const token = localStorage.getItem('token');
  try {
    await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    updateBadge(0);
    // Listedeki unread stilleri temizle
    document.querySelectorAll('.notif-item.notif-unread').forEach(el => {
      el.classList.remove('notif-unread');
      el.querySelector('.notif-dot')?.remove();
    });
  } catch {}
}

/* ══════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════ */
var notifOpen = false;
var notifTimer = null;

function initNotifications() {
  fetchUnreadCount();
  notifTimer = setInterval(fetchUnreadCount, 30000);
  document.addEventListener('click', e => {
    if (!e.target.closest('#notif-bell') && !e.target.closest('#notif-dropdown')) {
      closeNotifDropdown();
    }
  });
}

async function fetchUnreadCount() {
  if (!localStorage.getItem('token')) return;
  try {
    const res = await fetch(`${API_URL}/notifications/unread-count`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) return;
    const { count } = await res.json();
    const badge = document.getElementById('notif-badge');
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  } catch {}
}

async function toggleNotifDropdown() {
  if (notifOpen) { closeNotifDropdown(); return; }
  notifOpen = true;
  document.getElementById('notif-dropdown').classList.add('open');
  await loadNotifications();
}

function closeNotifDropdown() {
  notifOpen = false;
  document.getElementById('notif-dropdown').classList.remove('open');
}

async function loadNotifications() {
  const list = document.getElementById('notif-list');
  list.innerHTML = '<div class="notif-empty"><div class="spinner" style="margin:0 auto 8px;"></div>Loading...</div>';
  try {
    const res = await fetch(`${API_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error();
    const items = await res.json();

    if (!items.length) {
      list.innerHTML = '<div class="notif-empty"><div class="notif-empty-icon">🔔</div>No notifications yet</div>';
      return;
    }

    list.innerHTML = items.map(n => buildNotifItem(n)).join('');
    document.getElementById('notif-badge').classList.remove('visible');
  } catch {
    list.innerHTML = '<div class="notif-empty">Failed to load notifications</div>';
  }
}

function buildNotifItem(n) {
  const av = n.actor_avatar
    ? `<img class="notif-avatar" src="${escHtml(n.actor_avatar)}" alt="${escHtml(n.actor_username)}">`
    : `<div class="notif-avatar-placeholder">${getNotifIcon(n.type)}</div>`;

  const text = getNotifText(n);
  const ref  = n.ref_title ? `<div class="notif-ref">${escHtml(n.ref_title)}</div>` : '';
  const href = getNotifHref(n);

  return `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="openNotif(${n.id}, '${href}')">
      ${av}
      <div class="notif-body">
        <div class="notif-text">${text}</div>
        ${ref}
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
    </div>`;
}

function getNotifIcon(type) {
  const icons = { follow: '👤', like: '👍', reply: '💬', comment: '💬' };
  return icons[type] || '🔔';
}

function getNotifText(n) {
  const actor = `<strong>@${escHtml(n.actor_username)}</strong>`;
  switch (n.type) {
    case 'follow':  return `${actor} seni takip etmeye başladı`;
    case 'like':    return n.ref_type === 'thread'
                      ? `${actor} gönderini beğendi`
                      : `${actor} yorumunu beğendi`;
    case 'reply':
    case 'comment': return `${actor} ${n.ref_type === 'thread' ? 'gönderine' : 'yorumuna'} yanıt verdi`;
    default:        return `${actor} bir bildirim gönderdi`;
  }
}

function getNotifHref(n) {
  if (n.type === 'follow') return `profile.html?userId=${n.actor_id || ''}`;
  if (n.ref_type === 'thread' && n.ref_id) return `thread.html?id=${n.ref_id}`;
  if (n.ref_type === 'comment' && n.comment_thread_id) return `thread.html?id=${n.comment_thread_id}`;
  return '#';
}

async function openNotif(id, href) {
  try {
    await fetch(`${API_URL}/notifications/read/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
  } catch {}
  if (href && href !== '#') window.location.href = href;
}

async function markAllNotifRead() {
  try {
    const res = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error();

    document.querySelectorAll('.notif-item.unread').forEach(el => {  // ← notif-unread değil unread
      el.classList.remove('unread');
    });
    document.querySelectorAll('.notif-dot').forEach(el => el.remove());
    updateBadge(0);

  } catch { toast('Hata oluştu.', 'error'); }
}

async function clearAllNotifs() {
  try {
    const res = await fetch(`${API_URL}/notifications/clear-all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error();

    document.getElementById('notif-list').innerHTML = '<div class="notif-empty">No notifications yet</div>';
    updateBadge(0);
  } catch { toast('Hata oluştu.', 'error'); }
}

// app.js'e ekle — sayfa açılışında avatar yoksa çek
async function syncUserAvatar() {
  if (localStorage.getItem('userAvatar')) return; // zaten varsa çekme
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.avatar_url) localStorage.setItem('userAvatar', data.avatar_url);
  } catch {}
}