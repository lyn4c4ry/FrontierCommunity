const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/threads
// Returns all threads with author info, category, and aggregated counts.
// Optional filter: ?category=slug  or  ?category=id
router.get('/', async (req, res) => {
  const { category } = req.query;

  try {
    let query = `
      SELECT 
        t.*,
        u.username,
        u.avatar_url,
        c.name        AS category_name,
        c.slug        AS category_slug,
        COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_deleted = FALSE) AS comment_count,
        COUNT(DISTINCT l.id)  FILTER (WHERE l.value = 1)           AS like_count,
        COUNT(DISTINCT l.id)  FILTER (WHERE l.value = -1)          AS dislike_count
      FROM threads t
      JOIN users u           ON u.id = t.user_id
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN comments cm  ON cm.thread_id = t.id
      LEFT JOIN likes l      ON l.target_id = t.id AND l.target_type = 'thread'
    `;

    const params = [];

    if (category) {
      // Accept either a slug string or a numeric id
      if (isNaN(category)) {
        params.push(category);
        query += ` WHERE c.slug = $1`;
      } else {
        params.push(Number(category));
        query += ` WHERE t.category_id = $1`;
      }
    }

    query += ` GROUP BY t.id, u.username, u.avatar_url, c.name, c.slug ORDER BY t.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/threads/categories
// Returns all categories — used to populate the compose dropdown
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, slug FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/threads
// Creates a new thread. categoryId is optional.
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { title, content, categoryId } = req.body;

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  try {
    // Validate categoryId if provided — fall back to null if not found
    let resolvedCategoryId = null;
    if (categoryId) {
      const catCheck = await pool.query('SELECT id FROM categories WHERE id=$1', [categoryId]);
      if (catCheck.rows.length) resolvedCategoryId = categoryId;
    }

    const result = await pool.query(
      `INSERT INTO threads (title, content, user_id, category_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [title.trim(), content.trim(), userId, resolvedCategoryId]
    );

    // Return the full thread object including joined fields
    const full = await pool.query(
      `SELECT t.*, u.username, u.avatar_url,
              c.name AS category_name, c.slug AS category_slug,
              0 AS comment_count, 0 AS like_count, 0 AS dislike_count
       FROM threads t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(full.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/threads/:threadId
// Hard deletes a thread — only the owner is allowed
router.delete('/:threadId', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { threadId } = req.params;

  try {
    const check = await pool.query('SELECT user_id FROM threads WHERE id=$1', [threadId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Thread not found' });
    if (String(check.rows[0].user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM threads WHERE id=$1', [threadId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;