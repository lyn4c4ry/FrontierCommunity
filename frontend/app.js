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