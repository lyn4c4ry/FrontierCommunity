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