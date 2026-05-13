# FrontierCommunity — Project Documentation

## Overview

A gaming-focused forum/community site. Users can register, log in, open threads, and post comments. Follows a Twitter-like feed structure.

**Course:** Oral and Written Communication  
**Stack:** Vanilla JS (Frontend) + Node.js/Express (Backend) + PostgreSQL (Neon)

---

## Folder Structure

```
gameforum2/
├── backend/
│   ├── config/
│   │   └── db.js                   # Neon PostgreSQL connection (Pool)
│   ├── middleware/
│   │   ├── adminMiddleware.js       # Not yet active
│   │   └── authMiddleware.js        # JWT verify middleware — active on protected routes
│   ├── models/
│   │   ├── Comment.js
│   │   ├── Thread.js               # create, getAll
│   │   ├── Ticket.js               # Not yet implemented
│   │   └── User.js                 # create, findByEmail
│   ├── routes/
│   │   ├── adminRoutes.js          # Not yet implemented
│   │   ├── authRoutes.js           # /api/auth/register, /login, /profile, /profile/:userId, /stats
│   │   ├── commentRoutes.js        # GET /:threadId, POST /, DELETE /:commentId (soft), GET ?userId=
│   │   ├── interactionRoutes.js    # /api/like, /api/likes, /api/bookmark, /api/bookmarks
│   │   ├── newsRoutes.js           # /api/news/games — RAWG proxy; /api/news/articles — gaming news proxy (TODO)
│   │   ├── postRoutes.js
│   │   ├── searchRoutes.js         # /api/search?q= — threads + users ILIKE search
│   │   └── threadRoutes.js         # /api/threads GET, POST, DELETE /:threadId
│   ├── sql/
│   │   ├── schema.sql              # Table definitions
│   │   └── seed.sql                # Sample data (4 users, 4 categories, 8 threads, 19 comments)
│   ├── .env                        # DATABASE_URL, JWT_SECRET, PORT, RAWG_API_KEY, NEWS_API_KEY (TODO)
│   ├── package.json
│   ├── package-lock.json
│   └── server.js                   # Express app, route mount, port 5000
├── frontend/
│   ├── app.js                      # Shared frontend JS (API_URL, auth storage helpers, search, timeAgo, notifications)
│   ├── home.html                   # Thread feed — likes, bookmarks, nested comments, delete, ad sidebar
│   ├── index.html                  # Register + Login page (animated game cover background)
│   ├── logo_v1.png                 # Site logo
│   ├── news.html                   # Game News (RAWG API via backend proxy) + Gaming News tab (TODO)
│   ├── profile.html                # User profile — full home.html-quality thread cards + rich reply cards
│   ├── settings.html               # Settings page — theme, password change, delete account
│   ├── thread.html                 # Single thread detail page — COMPLETED
│   └── style.css
├── node_modules/
├── .gitignore
├── package.json
└── package-lock.json
```

---

## Database (Neon PostgreSQL)

**Connection:** Neon.tech — AWS EU Frankfurt (eu-central-1)  
**Connection type:** Connection Pooling active  
**SSL:** `sslmode=require&channel_binding=require`

### Tables

```sql
users       -- id, username, email, password_hash, avatar_url, bio, country, country_code, created_at
categories  -- id, name, description, slug
threads     -- id, title, content, user_id, category_id, created_at, updated_at
comments    -- id, thread_id, user_id, content, parent_id, is_deleted, created_at
likes       -- id, user_id, target_id, target_type ('thread'|'comment'), value (1|-1), created_at
bookmarks   -- id, user_id, thread_id, created_at
follows     -- follower_id, following_id
```

### Migration (already applied)

```sql
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS likes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id   INTEGER NOT NULL,
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('thread','comment')),
  value       SMALLINT NOT NULL CHECK (value IN (1, -1)),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, target_id, target_type)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id  INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, thread_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_target    ON likes(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_likes_user      ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user  ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(4);
```

### Seed Data (`sql/seed.sql`)

```bash
psql <connection_string> -f seed.sql
```

4 categories: `General Discussion`, `Gaming News`, `Guides & Tips`, `Introductions`

| id | username | email |
|----|----------|-------|
| 1 | admin_lyna | lyna@frontier.com |
| 2 | xNova | nova@frontier.com |
| 3 | PixelKnight | pixel@frontier.com |
| 4 | seco2 | seco2@frontier.com |

All passwords: `password123` — 8 threads, 19 comments distributed across categories.

**Verify after running:**
```sql
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'threads',    COUNT(*) FROM threads
UNION ALL SELECT 'comments',   COUNT(*) FROM comments;
-- Expected: 4 / 4 / 8 / 19
```

---

## Backend

### Running
```bash
cd backend
node server.js
# Server is running on port 5000
# PostgreSQL: Database bridge established successfully! 🚀
```

### .env Structure
```env
DATABASE_URL=postgresql://neondb_owner:...@ep-....eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=frontier_super_secret_key_2024
PORT=5000
RAWG_API_KEY=your_rawg_key_here
NEWS_API_KEY=your_news_api_key_here   # TODO — GNewsAPI or NewsAPI
```

> **Note:** Project uses `dotenvx` (not plain `dotenv`). `require('@dotenvx/dotenvx').config()` must be the **first line** of `server.js`, before any `process.env` access. If it runs after route imports, env vars will be undefined at startup.

### db.js
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
```

### server.js — Route Mount

```js
app.use(cors());
app.use(express.json());

app.use('/api/news', newsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api', interactionRoutes);
app.use('/api', searchRoutes);
```

> **Important:** `authMiddleware` must NOT be applied globally in `server.js`. It is imported and applied per-route (POST, DELETE only) inside each router file.

### API Endpoints

#### Auth — `/api/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | ❌ | Register new user (bcrypt hash) |
| POST | `/login` | ❌ | Login → returns JWT (7d expiry) |
| GET | `/profile` | ✅ | Get own profile from token |
| GET | `/profile/:userId` | ❌ | Get any user's public profile (returns `thread_count`, `comment_count`, `avatar_url`, `bio`, `country`, `country_code`) |
| PUT | `/profile` | ✅ | Update username, bio, avatar_url, country, country_code |
| PUT | `/password` | ✅ | Change password (current + new, bcrypt verify) |
| DELETE | `/account` | ✅ | Delete own account + all user data (cascade) |
| GET | `/stats` | ❌ | Live member/thread/reply counts |

#### Threads — `/api/threads`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | ❌ | Get all threads (optional `?category=`) |
| GET | `/categories` | ❌ | Get all categories |
| POST | `/` | ✅ | Create thread (`title`, `content`, `categoryId`) |
| DELETE | `/:threadId` | ✅ | Delete own thread (hard delete) |

#### Comments — `/api/comments`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:threadId` | ❌ | Get all comments for thread (with `parent_id`, `is_deleted`, `avatar_url`) |
| GET | `/` | ❌ | `?userId=` — comment history; ideally returns `t_id`, `t_title`, `t_content`, `t_created_at`, `t_author_id`, `t_author_username`, `t_author_avatar`, `category_name` for rich reply cards |
| POST | `/` | ✅ | Post comment (`threadId`, `content`, `parentId`) |
| DELETE | `/:commentId` | ✅ | Soft delete (sets `is_deleted=true`) |

#### Interactions — `/api`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/like` | ✅ | Like/dislike thread or comment (`targetId`, `targetType`, `value`) |
| GET | `/likes` | ❌ | Get like counts |
| POST | `/likes/batch` | ❌ | Batch fetch likes; supports `targetType` param for comment likes |
| POST | `/bookmark` | ✅ | Toggle bookmark |
| GET | `/bookmarks/:userId` | ❌ | Get user's bookmarked threads |

#### Follow — `/api/follow`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | ✅ | Follow/unfollow (`targetUserId`) → returns `{ isFollowing }` |
| GET | `/stats/:userId` | ❌ | Returns `{ followers, following }` counts |
| GET | `/check/:userId` | ✅ | Returns `{ isFollowing }` for logged-in user |
| GET | `/followers/:userId` | ❌ | List of follower user objects |
| GET | `/following/:userId` | ❌ | List of following user objects |

#### Search — `/api`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/search?q=` | ❌ | ILIKE search on threads + users |

#### News — `/api/news`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/games` | ❌ | RAWG proxy — supports `search`, `genre`, `ordering`, `platforms`, `page`, `page_size`, `next` |
| GET | `/articles` | ❌ | **TODO** — Gaming news proxy (GNewsAPI or NewsAPI); supports `q`, `page` |

---

## Frontend Pages

### app.js

#### Auth Storage Helpers
Tüm sayfalarda `localStorage` yerine bu helper'lar kullanılmalı — "Remember me" kapalı girişlerde token `localStorage`'a yazılır ama `fc_no_remember` flag'i ile tab kapanınca temizlenir.

```javascript
getToken()       // localStorage || sessionStorage
getUserId()      // localStorage || sessionStorage
getUsername()    // localStorage || sessionStorage
getUserAvatar()  // localStorage || sessionStorage
clearAuthStorage() // her ikisini de temizler
```

#### Remember Me Sistemi

**Davranış:**
- **Remember me açık** → token `localStorage`'a yazılır, `fc_no_remember` flag'i yok → kalıcı (7 gün, JWT expiry kadar)
- **Remember me kapalı** → token yine `localStorage`'a yazılır ama `fc_no_remember=1` flag'i `localStorage`'a, `no_remember` flag'i `sessionStorage`'a konur → tab/tarayıcı kapanınca `app.js` başlangıcında token temizlenir
- **F5 / sayfa yenileme** → `sessionStorage` korunur, token silinmez ✓
- **Tab kapanıp yeniden açılma** → `sessionStorage` sıfırlanır, `app.js` `fc_no_remember=1` görür, `clearAuthStorage()` çalışır ✓

**`handleLogin()` akışı (`index.html`):**
```javascript
// Remember me kapalıysa:
localStorage.setItem('fc_no_remember', '1');
sessionStorage.setItem('no_remember_pending', '1');
// Redirect öncesi pending flag sayfa geçişinde korunur

// Remember me açıksa:
localStorage.removeItem('fc_no_remember');
```

**`app.js` başlangıç kontrolü:**
```javascript
// no_remember_pending → no_remember'a çevir (sayfa geçişinden geldi)
if (sessionStorage.getItem('no_remember_pending') === '1') {
  sessionStorage.removeItem('no_remember_pending');
  sessionStorage.setItem('no_remember', '1');
}

// Tab yeniden açıldıysa (sessionStorage sıfır, fc_no_remember var) → temizle
if (localStorage.getItem('token') &&
    !sessionStorage.getItem('no_remember') &&
    !sessionStorage.getItem('no_remember_pending') &&
    localStorage.getItem('fc_no_remember') === '1') {
  clearAuthStorage();
  localStorage.removeItem('fc_no_remember');
}
```

---

### index.html

#### Login Formu
- Email + Password alanları
- **"Remember me" checkbox** — varsayılan `checked`; işaretsizse tab kapanınca oturum sona erer
- "Forgot your password?" linki → forgot panel'e geçer
- Tab bar: Login / Register sekmeleri
- Forgot Password ve Reset Password panelleri (tab bar gizlenir)

#### Animated Background
- RAWG API'den 20 oyun kapağı çekilir, 24h `localStorage` cache (`fc_bg_covers`)
- CSS div kartları sütunlar halinde yukarı kayar (slow/mid/fast)
- Fallback: sabit koyu renkler

#### Live Stats
- `GET /api/auth/stats` → members / threads / replies sayıları, ≥1000 → `K` formatı

---

### home.html

#### Layout
Four-column layout: left sidebar (Nav) / center feed (Threads + Compose) / right sidebar (Widgets) / ad sidebar (Ad slots)

#### Ad Sidebar
- Fixed width: `480px`, position sticky, scrollbar hidden
- Three ad slot containers: `.ad-slot.ad-banner` (160×250), `.ad-slot.ad-square` (160×160), `.ad-slot.ad-tall` (160×400)
- Hidden below `1700px` viewport width via media query
- Each slot ready for Google AdSense `<ins>` tag or custom sponsor HTML

#### Functions

| Function | Description |
|----------|-------------|
| `initHome()` | Auth check, avatar set, bookmark preload, compose prefill, loadCategories, loadThreads |
| `loadCategories()` | Fetches `/api/threads/categories`, populates compose select + filter chips |
| `selectCategoryChip(btn, value)` | Activates chip, filters thread feed |
| `loadThreads(categoryFilter)` | Fetches threads + parallel comments + batch likes |
| `fetchBatchLikes(threadIds)` | POST `/api/likes/batch` — returns like state for all threads |
| `loadSidebarWidgets(threads)` | Calls loadTopDiscussions + loadNewMembers |
| `loadTopDiscussions(threads)` | Ranks threads by score, renders top 5 |
| `loadNewMembers()` | Fetches recent posters, renders member list |
| `buildThreadCard(t, comments, i)` | Builds full thread card DOM element |
| `buildCommentsHTML(comments, threadId, parentId, depth)` | Recursive comment tree HTML |
| `buildCommentItem(c, all, threadId, depth)` | Single comment with nested replies |
| `showMore(btn, threadId, idsJson)` | Expands/collapses hidden comments (toggle) |
| `toggleReplyForm(id)` | Shows/hides inline reply input |
| `refreshComments(threadId)` | Re-fetches and re-renders comment tree |
| `voteThread / voteComment` | Like/dislike with live count update |
| `toggleBookmark` | Bookmark toggle |
| `deleteThread` | Delete own thread |
| `deleteComment` | Soft delete → re-render |
| `postReply(parentId)` | Post top-level or nested reply |
| `showConfirm(opts)` | Async confirm modal for destructive actions |

---

### thread.html

- Shareable URL: `thread.html?id=X`
- Full nested comment tree (recursive, indented up to 80px)
- Like/dislike on thread and all comments
- Bookmark toggle
- Delete thread (owner) → redirects to home
- Delete comment (owner) → soft delete, re-renders
- Confirm modal for destructive actions
- Author links to `profile.html?userId=X`

---

### profile.html

#### Layout
Three-column layout: left sidebar (Info + Badges) / center feed (Threads + Replies tabs) / right column (reserved)

#### Tabs

| Tab | Content |
|-----|---------|
| 🧵 Threads | Full home.html-quality thread cards — like/dislike, bookmark, nested comment tree, show/hide more, inline reply, delete (own), click to `thread.html` |
| 💬 Replies | Rich reply cards — thread context (author avatar, title, preview, category, time) + user's reply in a styled bubble + delete (own) + "Go to thread →" link |

#### State

```js
var pState = {
  myUserId, myUsername, viewedUserId,   // kendi vs. başkasının profili
  token, isFollowing, currentAvatar,
  _countryCode                           // edit modal için ülke kodu cache
};

var pLikeCache     = {};   // { "thread_123": {likes,dislikes,userVote}, "comment_456": ... }
var pBookmarkCache = new Set();
var pCommentCache  = {};   // { threadId: [comments] }
```

#### Functions

| Function | Description |
|----------|-------------|
| `initProfile()` | Auth check, `syncUserAvatar()`, sidebar fill, URL param `?userId=` detect, bookmark preload, `loadProfileData()`, `initNotifications()` |
| `syncUserAvatar()` | `GET /api/auth/profile/:userId` → refreshes avatar/username in localStorage |
| `loadProfileData()` | Fetches profile, fills hero, avatar, country row, follow stats, own vs. other button logic, parallel `loadProfileThreads()` + `loadProfileReplies()`, `renderBadges()` |
| `loadFollowStats()` | `GET /api/follow/stats/:userId` → fills followers/following counts |
| `checkFollowStatus()` | `GET /api/follow/check/:userId` → sets `pState.isFollowing`, updates button UI |
| `toggleFollowUser()` | `POST /api/follow` → toggles follow, updates button + stats |
| `updateFollowButtonUI()` | Switches button between Follow / Unfollow styles |
| `loadProfileThreads()` | Fetches all threads, filters by `viewedUserId`, parallel comment + like fetch, renders `pBuildThreadCard()` cards |
| `pFetchBatchLikes(threadIds)` | `POST /api/likes/batch` for thread like states |
| `pBuildThreadCard(t, comments, i)` | Full home.html-quality thread card |
| `pBuildCommentsHTML(comments, threadId, parentId, depth)` | Recursive comment tree HTML |
| `pBuildCommentItem(c, all, threadId, depth)` | Single comment bubble with indentation, like/dislike, reply form, delete |
| `pShowMore(btn, threadId, idsJson)` | Expands hidden comments; clicking again hides them (toggle) |
| `pToggleReplyForm(id)` | Shows/hides nested reply input |
| `pRefreshComments(threadId)` | Re-fetches and re-renders comment section |
| `pVoteThread(threadId, value)` | Like/dislike thread |
| `pVoteComment(commentId, value, threadId)` | Like/dislike comment |
| `pToggleBookmark(threadId)` | Bookmark toggle with cache update |
| `pDeleteThread(threadId)` | Confirm → `DELETE /api/threads/:id` → remove card, update stat |
| `pDeleteComment(commentId, threadId)` | Confirm → soft delete → refresh comment tree |
| `pPostReply(threadId, parentId)` | Post top-level or nested reply → refresh comment tree |
| `loadProfileReplies()` | `GET /api/comments?userId=` → renders rich reply cards |
| `pBuildReplyCard(r)` | Rich reply card: thread context block + reply bubble |
| `pDeleteStandaloneReply(commentId, btn)` | Confirm → soft delete reply from Replies tab |
| `renderBadges(threadCount, commentCount)` | Renders badge chips based on activity thresholds |
| `switchTab(id, btn)` | Switches between Threads / Replies tabs |
| `openModal()` / `closeModal()` | Opens/closes profile edit modal |
| `saveProfile()` | `PUT /api/auth/profile` → updates username, bio, avatar_url |
| `openUserListModal(type)` | Opens followers/following list modal |

#### Features
- **Own vs. other profile:** `?userId=X` shows another user's profile; Edit button only for own, Follow/Unfollow for others
- **Threads tab:** full home.html-quality cards
- **Replies tab:** rich cards with thread context + reply bubble
- **Avatar:** drag & drop or URL paste in edit modal
- **Country:** displayed in Info card with emoji flag; editable via dropdown
- **Badges:** client-side thresholds (First Thread, Chatter, Power User, Prolific, Voice of Community)
- **Follow system:** followers/following counts clickable → modal with user list
- **Notification bell:** UI present, dropdown placeholder — backend TODO

#### Backend Note for Replies Tab
`GET /api/comments?userId=` should return these extra fields for full thread context:

```sql
t.id         AS t_id,
t.title      AS t_title,
t.content    AS t_content,
t.created_at AS t_created_at,
u.id         AS t_author_id,
u.username   AS t_author_username,
u.avatar_url AS t_author_avatar,
c.name       AS category_name
```

If only `thread_title` is returned, the card degrades gracefully (shows title only, no author/preview).

---

### news.html

#### Functions

| Function | Description |
|----------|-------------|
| `initNews()` | Auth check, avatar set, watchlist load, calls `fetchGames(true)` |
| `fetchGames(reset)` | Fetches from `/api/news/games`; resets grid if reset=true |
| `loadMore()` | Appends next page via RAWG `next` URL |
| `renderGames(games, replace)` | Renders games in active view (grid/list) |
| `buildGameCard(g, idx)` | Grid card — cover hover overlay + Discuss button, score badge, follow button |
| `buildListItem(g, idx)` | List row — small cover, meta info, Discuss + follow buttons |
| `setView(v)` | Switches to `'grid'` or `'list'` view |
| `toggleFollow(gameId)` | Adds/removes game from watchlist, saves to localStorage |
| `renderWatchlist()` | Updates right sidebar watchlist widget |
| `openDiscuss(gameName)` | Writes game name to sessionStorage, redirects to home.html |
| `buildGenreBar()` | Builds genre chips + My List chip |
| `selectGenre(btn, genreId)` | Genre selection — triggers fetch |
| `applyFilters()` | Applies sort and platform filters |
| `onSearch()` | Debounced search with 400ms delay |
| `toast(msg, type)` | Toast notification system |
| `escHtml(str)` | XSS sanitize |

#### Filters

| Filter | Options |
|--------|---------|
| Search | Debounced text search (RAWG `search` param) |
| Sort | Newest / Top Rated / Popular / A→Z |
| Platform | All / PC / PS5 / PS4 / Xbox One / Xbox Series / Switch |
| Genre | All, Action, Indie, Adventure, RPG, Shooter, Puzzle, Arcade, Platformer, Racing, Sports, Fighting, Simulation, Strategy |
| My List | Shows only followed games (inside genre bar) |

#### Watchlist System
- Followed games stored in `localStorage` → `fc_watchlist` key as JSON: `{ [gameId]: gameObject }`
- Right sidebar watchlist widget — ✕ to remove, click name to smooth scroll to card
- Fully client-side, backend-independent

#### Discuss Flow (news → home)
1. Click "💬 Discuss" on a game card
2. `sessionStorage.setItem('compose_prefill', gameName)`
3. Redirect to `home.html`
4. `initHome()` checks prefill, fills compose title, clears sessionStorage, scrolls to compose

---

### settings.html

#### Sections
- **Appearance** — Theme selector: Dark / Light / Game Mode; saved to `localStorage`
- **Account** — Change password (current + new + confirm) → `PUT /api/auth/password`; Delete account → `DELETE /api/auth/account`
- **Preferences** — Language + timezone (saved to localStorage, used by `timeAgo`)
- **Notifications** — Toggle placeholders for future notification system

---

## localStorage Keys (Global)

| Key | Type | Description |
|-----|------|-------------|
| `token` | string | JWT token (set on login) |
| `username` | string | Logged-in username |
| `userId` | string | User ID |
| `userBio` | string | Cached profile bio |
| `userAvatar` | string | Cached avatar URL |
| `userJoined` | string | Cached join date |
| `fc_no_remember` | string | `'1'` if logged in without "Remember me" — triggers `clearAuthStorage()` on next fresh tab open |
| `fc_watchlist` | JSON string | Followed games `{ [id]: gameObject }` |
| `fc_bg_covers` | JSON string | Cached RAWG cover URLs for index.html background |
| `fc_bg_covers_time` | number | Timestamp of last RAWG fetch for 24h cache |
| `fc_theme` | string | Active theme: `'dark'` \| `'light'` \| `'game'` *(settings.html)* |
| `fc_pref_language` | string | UI language preference (e.g. `'en'`, `'tr'`) |
| `fc_pref_timezone` | string | IANA timezone override (e.g. `'Europe/Istanbul'`); used by `timeAgo` and `fullDate` |
| `fc_notif_replies` | string | `'1'` or `'0'` — notify on thread replies |
| `fc_notif_likes` | string | `'1'` or `'0'` — notify on likes |
| `fc_notif_followers` | string | `'1'` or `'0'` — notify on new followers |
| `fc_notif_announcements` | string | `'1'` or `'0'` — notify on announcements |

## sessionStorage Keys (Global)

| Key | Type | Description |
|-----|------|-------------|
| `no_remember` | string | `'1'` if current session is "no remember me" — set by `app.js` on load |
| `no_remember_pending` | string | `'1'` during redirect from login to home — converted to `no_remember` on arrival |

---

## Completed ✅

- Neon DB connection
- Register (bcrypt hash saved to DB)
- Login (JWT token returned, 7-day expiry)
- Thunder Client API tests
- Frontend register/login page working
- `interactionRoutes.js` — full like/dislike/bookmark implementation
- `commentRoutes.js` — GET with parent_id + is_deleted, POST with parentId, soft DELETE
- `threadRoutes.js` — DELETE route (owner only, hard delete)
- `server.js` — all routes mounted
- `home.html` — full rewrite: likes, dislikes, bookmarks, nested comments, delete, compose prefill, parallel fetch, toast, XSS fix, community stats
- `timeAgo` — Istanbul timezone bug fixed, 24h format, correct "Yesterday" boundary, `just now` + `Xm ago`
- Seed: 4 users / 4 categories / 8 threads / 19 comments
- `GET /api/auth/profile/:userId` — thread_count, comment_count
- `PUT /api/auth/profile` — dynamic SQL update (no COALESCE overwrite bug)
- `GET /api/comments?userId=` — user comment history
- `news.html` — RAWG proxy, filters, watchlist, discuss flow, grid/list, static fallback
- Logo visible on all pages
- **JWT auth middleware applied per-route** — POST/DELETE only; GET routes remain public
- **`thread.html`** — full comment tree, like/dislike, bookmark, delete, nested replies, shareable URL
- **Thread card click navigation** — entire card → `thread.html?id=X`; avatar/username → profile
- **JWT payload fix** — login signs `{ userId: user.id }` to match `authMiddleware`
- **JWT expiry extended** — `1h` → `7d`
- **`interactionRoutes.js` auth fix** — `userId` from `req.user.userId` (JWT), not request body
- **`dotenvx` load order fix** — must be first line of `server.js`
- **Global search** — `searchRoutes.js` (`GET /api/search?q=`); ILIKE on threads + users; debounced dropdown (400ms); search bar in `home.html`, `profile.html`, `thread.html`
- **`GET /api/auth/stats`** — live member/thread/reply count for login page; no auth required
- **`index.html` animated background** — full-screen CSS div card columns with real RAWG game covers; 24h localStorage cache; seamless infinite scroll animation; CORS-safe
- **`index.html` live stats** — member/thread/reply counts fetched from DB on page load, formatted as `K` when ≥1000
- **`home.html` ad sidebar** — 480px sticky right column, 3 IAB-standard ad slots, hidden below 1700px
- **`settings.html`** — Appearance, Account (password change + delete), Preferences, Notifications; password change and delete account wired to backend
- **`PUT /api/auth/password`** — change password with current password verification (bcrypt)
- **`DELETE /api/auth/account`** — delete own account with password confirmation; cascades to all user data
- **`timeAgo` + `parseDateSafely` moved to `app.js`** — shared across all pages; reads `fc_pref_timezone` from localStorage
- **`fullDate` timezone fix** — reads `fc_pref_timezone` from localStorage instead of hardcoded `Europe/Istanbul`
- **Timestamp migration** — `threads`, `comments`, `users` `created_at` columns migrated to `TIMESTAMPTZ`
- **Comment like persistence** — `POST /api/likes/batch` extended with `targetType` param; `home.html` and `thread.html` batch-fetch comment like states on load
- **Show/Hide comments toggle** — "Show N more comments" button toggles; clicking again hides extra comments
- **Settings nav link** — ⚙️ Settings added to left sidebar nav on all pages
- **JWT_SECRET fallback kaldırıldı** — `authRoutes.js`'deki `|| 'secretkey'` fallback temizlendi
- **Trending / Top Discussions → thread navigation** — `thread.html?id=X`'e yönlendiriyor
- **Trending counts gerçek DB'den** — Sidebar like/comment sayıları canlı DB verisiyle geliyor
- **Follow / Unfollow sistemi** — `follows` tablosu; profilde takipçi/takip sayıları + modal user listesi
- **Level chip kaldırıldı** — `profile.html`'den tamamen temizlendi
- **Activity heatmap kaldırıldı** — `profile.html`'den tamamen temizlendi
- **`profile.html` tam yeniden yazıldı** — home.html kalitesinde thread kartları + zengin reply kartları; `syncUserAvatar()`, `initNotifications()`, `pDeleteStandaloneReply()` eklendi; country/country_code edit modal'a dahil edildi
- **"Remember me" checkbox** — `index.html` login formuna eklendi; kapalıysa tab kapanınca `clearAuthStorage()` tetiklenir; açıksa 7 gün kalıcı
- **`app.js` auth storage helpers** — `getToken()`, `getUserId()`, `getUsername()`, `getUserAvatar()`, `clearAuthStorage()` eklendi; tüm notification ve avatar fonksiyonları helper'ları kullanıyor

---

## TODO

### Gaming News
- [ ] **`GET /api/news/articles`** — GNewsAPI veya NewsAPI proxy; `q`, `page` params; `NEWS_API_KEY` `.env`'e eklenecek
- [ ] **`news.html` News sekmesi** — mevcut Games sekmesinin yanına "News" sekmesi; haber kartları (başlık, kaynak, resim, özet, link)

### Notifications
- [ ] **Notification sistemi** — Sağ üstte bell icon + unread badge (UI mevcut, backend yok). DB tablosu: `notifications (id, user_id, type, ref_id, read, created_at)`. Tüm sayfalarda görünecek.

### Badges
- [ ] **Badge sistemi** — ~50 badge DB'de `badges` tablosunda tutulacak. `user_badges (user_id, badge_id, awarded_at)` tablosu. Şu an client-side threshold ile çalışıyor.

### Backend — Replies Tab Enrichment
- [ ] **`GET /api/comments?userId=`** — `t_author_username`, `t_author_avatar`, `t_content`, `t_created_at`, `category_name` alanlarını JOIN ile döndürecek şekilde güncellenmeli

### Data & Performance
- [ ] **Watchlist → DB'ye taşınacak** — Şu an `localStorage` tabanlı; `watchlist` tablosuna taşınacak, login'de sync yapılacak.

### Thread & Content
- [ ] **Home feed sort geliştirmesi** — en yeni / en beğenilen / en çok yorumlanan sort seçenekleri.

### Admin
- [ ] **`adminRoutes.js` + `Ticket.js`** — Admin dashboard, kullanıcı yönetimi, ticket/report sistemi.

---

## Ertelendi / Kaldırıldı

- ~~**Light / Game Mode themes**~~ — Ertelendi; settings'de placeholder olarak kalacak.
- ~~**Activity heatmap**~~ — Kaldırıldı.
- ~~**Level perks sistemi**~~ — Tamamen kaldırıldı.
