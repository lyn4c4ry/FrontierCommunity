const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// GET /api/search?q=keyword&type=all|threads|users
// Global search across threads (title + content) and users (username).
// Minimum query length: 2 characters. Results capped at 20 threads / 10 users.
router.get('/', async (req, res) => {
  const { q, type = 'all' } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const term = `%${q.trim()}%`;

  try {
    let threads = [];
    let users   = [];

    if (type === 'all' || type === 'threads') {
      const threadResult = await pool.query(
        `SELECT 
          t.id, t.title, t.content, t.created_at,
          u.username, u.avatar_url,
          c.name AS category_name, c.slug AS category_slug,
          COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_deleted = FALSE) AS comment_count,
          COUNT(DISTINCT l.id)  FILTER (WHERE l.value = 1)           AS like_count
         FROM threads t
         JOIN users u           ON u.id = t.user_id
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN comments cm  ON cm.thread_id = t.id
         LEFT JOIN likes l      ON l.target_id = t.id AND l.target_type = 'thread'
         WHERE t.title ILIKE $1 OR t.content ILIKE $1
         GROUP BY t.id, u.username, u.avatar_url, c.name, c.slug
         ORDER BY t.created_at DESC
         LIMIT 20`,
        [term]
      );
      threads = threadResult.rows;
    }

    if (type === 'all' || type === 'users') {
      const userResult = await pool.query(
        `SELECT id, username, avatar_url, bio, created_at
         FROM users
         WHERE username ILIKE $1
         ORDER BY username
         LIMIT 10`,
        [term]
      );
      users = userResult.rows;
    }

    res.json({
      query: q.trim(),
      threads,
      users,
      total: threads.length + users.length
    });

  } catch (e) {
    res.status(500).json({ error: 'Search failed: ' + e.message });
  }
});

module.exports = router;