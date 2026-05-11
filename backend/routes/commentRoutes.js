const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// GET /api/comments/:threadId
router.get('/:threadId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.thread_id, c.user_id, c.content, c.parent_id,
              c.is_deleted, c.created_at, u.username
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.thread_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.threadId]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/comments?userId=
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const result = await pool.query(
      `SELECT c.*, u.username
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.user_id = $1 AND c.is_deleted = FALSE
       ORDER BY c.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/comments  { threadId, userId, content, parentId }
router.post('/', async (req, res) => {
  const { threadId, userId, content, parentId } = req.body;
  if (!threadId || !userId || !content?.trim()) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO comments (thread_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [threadId, userId, content.trim(), parentId || null]
    );
    const full = await pool.query(
      `SELECT c.*, u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=$1`,
      [result.rows[0].id]
    );
    res.status(201).json(full.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/comments/:commentId  { userId }  → soft delete
router.delete('/:commentId', async (req, res) => {
  const { userId } = req.body;
  const { commentId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const check = await pool.query('SELECT user_id FROM comments WHERE id=$1', [commentId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Not found' });
    if (String(check.rows[0].user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query(
      "UPDATE comments SET is_deleted=TRUE, content='[deleted]' WHERE id=$1",
      [commentId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;