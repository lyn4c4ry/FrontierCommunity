const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// GET /api/threads
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, u.username
       FROM threads t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/threads
router.post('/', async (req, res) => {
  const { title, content, userId } = req.body;
  if (!title?.trim() || !content?.trim() || !userId) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO threads (title, content, user_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [title.trim(), content.trim(), userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/threads/:threadId  { userId }
router.delete('/:threadId', async (req, res) => {
  const { userId } = req.body;
  const { threadId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const check = await pool.query('SELECT user_id FROM threads WHERE id=$1', [threadId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Not found' });
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