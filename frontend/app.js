// ─── GLOBAL CONFIG ───────────────────────────────────────────────────────────
const API_URL = 'http://localhost:5000/api';
console.log("APP.JS YUKLENDI");

// ── REMEMBER ME ──────────────────────────────────────────────────────────────
if (sessionStorage.getItem('no_remember_pending') === '1') {
  sessionStorage.removeItem('no_remember_pending');
  sessionStorage.setItem('no_remember', '1');
}

// Sayfa yüklenince kontrol: token var ama no_remember flag'i yoksa
// (yani tab kapanıp yeniden açılmış) — localStorage'ı temizle
if (localStorage.getItem('token') && !sessionStorage.getItem('no_remember') && !sessionStorage.getItem('no_remember_pending')) {
  // Eğer hiç no_remember flag'i yoksa bu kullanıcı ya remember me ile giriş yaptı
  // ya da tab kapanmış. Bunu ayırt etmek için remember_me kalıcı flag'i kontrol et.
  if (localStorage.getItem('fc_no_remember') === '1') {
    clearAuthStorage();
    localStorage.removeItem('fc_no_remember');
  }
}

// ─── AUTH STORAGE HELPERS ────────────────────────────────────────────────────
function getToken()      { return localStorage.getItem('token')      || sessionStorage.getItem('token'); }
function getUserId()     { return localStorage.getItem('userId')     || sessionStorage.getItem('userId'); }
function getUsername()   { return localStorage.getItem('username')   || sessionStorage.getItem('username'); }
function getUserAvatar() { return localStorage.getItem('userAvatar') || sessionStorage.getItem('userAvatar'); }

function clearAuthStorage() {
  ['token', 'username', 'userId', 'userAvatar', 'userBio', 'userJoined'].forEach(k => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
}

// ─── PROFILE UI ──────────────────────────────────────────────────────────────
function updateProfileUI() {
  const username = getUsername();
  if (document.getElementById('display-username')) {
    document.getElementById('display-username').innerText = `@${username}`;
  }
  if (document.getElementById('user-pp')) {
    document.getElementById('user-pp').src = `https://ui-avatars.com/api/?name=${username}&background=6f42c1&color=fff`;
  }
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
function handleLogout() {
  clearAuthStorage();
  window.location.href = 'index.html';
}

// ─── LOAD USER THREADS ───────────────────────────────────────────────────────
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

// ─── THREAD / REPLY (sadece sayfa kendi tanımlamadıysa) ──────────────────────
if (typeof createThread === 'undefined') {
  window.createThread = async function () {
    const title   = document.getElementById('thread-title').value;
    const content = document.getElementById('thread-content').value;
    const userId  = getUserId();
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
    const userId  = getUserId();
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

// ─── TIME AGO ────────────────────────────────────────────────────────────────
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

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
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
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/notifications/unread-count`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { count } = await res.json();
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
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
  const dd = document.getElementById('notif-dropdown');
  if (dd) dd.classList.remove('open');
}

async function loadNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div class="notif-empty"><div class="spinner" style="margin:0 auto 8px;"></div>Loading...</div>';
  try {
    const res = await fetch(`${API_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error();
    const items = await res.json();

    if (!items.length) {
      list.innerHTML = '<div class="notif-empty"><div class="notif-empty-icon">🔔</div>No notifications yet</div>';
      return;
    }

    list.innerHTML = items.map(n => buildNotifItem(n)).join('');
    const badge = document.getElementById('notif-badge');
    if (badge) badge.classList.remove('visible');
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
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
  } catch {}
  if (href && href !== '#') window.location.href = href;
}

async function markAllNotifRead() {
  try {
    const res = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error();
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    document.querySelectorAll('.notif-dot').forEach(el => el.remove());
    const badge = document.getElementById('notif-badge');
    if (badge) badge.classList.remove('visible');
  } catch {}
}

async function clearAllNotifs() {
  try {
    const res = await fetch(`${API_URL}/notifications/clear-all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error();
    const list = document.getElementById('notif-list');
    if (list) list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
    const badge = document.getElementById('notif-badge');
    if (badge) badge.classList.remove('visible');
  } catch {}
}

async function syncUserAvatar() {
  if (getUserAvatar()) return;
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.avatar_url) {
      // Write to whichever storage the token lives in
      if (localStorage.getItem('token')) {
        localStorage.setItem('userAvatar', data.avatar_url);
      } else {
        sessionStorage.setItem('userAvatar', data.avatar_url);
      }
    }
  } catch {}
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}