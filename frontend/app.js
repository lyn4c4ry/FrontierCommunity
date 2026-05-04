const API_URL = 'http://localhost:5000/api';

/**
 * Updates the small profile card in Home or Profile pages
 */
function updateProfileUI() {
    const username = localStorage.getItem('username');
    if (document.getElementById('display-username')) {
        document.getElementById('display-username').innerText = `@${username}`;
    }
    if (document.getElementById('user-pp')) {
        document.getElementById('user-pp').src = `https://ui-avatars.com/api/?name=${username}&background=6f42c1&color=fff`;
    }
}

/**
 * Handle user registration
 */
async function handleRegister() {
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });

    if (response.ok) alert("Registration successful!");
}

/**
 * Handle login and redirect to Home
 */
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('userId', data.user.id);
        window.location.href = 'home.html'; // Move to Home page
    } else {
        alert("Login failed: " + data.message);
    }
}

/**
 * Global logout function
 */
function handleLogout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

/**
 * Create a new thread (Tweet)
 */
async function createThread() {
    const title = document.getElementById('thread-title').value;
    const content = document.getElementById('thread-content').value;
    const userId = localStorage.getItem('userId');

    await fetch(`${API_URL}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, userId })
    });

    document.getElementById('thread-title').value = '';
    document.getElementById('thread-content').value = '';
    loadThreads();
}

/**
 * Load all threads and their respective comments
 */
async function loadThreads() {
    const listDiv = document.getElementById('threads-list');
    const response = await fetch(`${API_URL}/threads`);
    const threads = await response.json();

    listDiv.innerHTML = '';
    for (const t of threads) {
        // Fetch comments for each thread
        const cRes = await fetch(`${API_URL}/comments/${t.id}`);
        const comments = await cRes.json();

        listDiv.innerHTML += `
            <div class="thread-item">
                <strong>${t.title}</strong>
                <small>@${t.username} • ${new Date(t.created_at).toLocaleDateString()}</small>
                <p>${t.content}</p>
                <div style="margin-left: 15px; border-left: 2px solid #333; padding-left: 10px;">
                    ${comments.map(c => `<div style="font-size:12px;"><span style="color:#bb86fc;">@${c.username}:</span> ${c.content}</div>`).join('')}
                    <div style="display:flex; gap:5px; margin-top:5px;">
                        <input type="text" id="reply-${t.id}" placeholder="Reply..." style="padding:4px; font-size:12px; margin:0;">
                        <button onclick="postReply(${t.id})" style="width:auto; padding:4px 8px; font-size:11px; background:#6f42c1;">Reply</button>
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Loads threads only for a specific user
 * @param {string} username 
 */
async function loadUserThreads(username) {
    const listDiv = document.getElementById('user-threads-list');
    try {
        const response = await fetch(`${API_URL}/threads`);
        const allThreads = await response.json();
        
        // Filter threads to show only those belonging to the specific user
        const userThreads = allThreads.filter(t => t.username === username);

        listDiv.innerHTML = userThreads.length > 0 ? '' : '<p style="color:#888;">No threads posted yet.</p>';

        for (const t of userThreads) {
            const cRes = await fetch(`${API_URL}/comments/${t.id}`);
            const comments = await cRes.json();

            listDiv.innerHTML += `
                <div class="thread-item">
                    <strong>${t.title}</strong>
                    <small>${new Date(t.created_at).toLocaleDateString()}</small>
                    <p>${t.content}</p>
                    <div style="margin-top:10px; font-size:12px; color:#888;">
                        ${comments.length} Replies
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error("Profile Load Error:", error);
    }
}

/**
 * Post a reply to a thread
 */
async function postReply(threadId) {
    const content = document.getElementById(`reply-${threadId}`).value;
    const userId = localStorage.getItem('userId');

    await fetch(`${API_URL}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, userId, content })
    });
    loadThreads();
}