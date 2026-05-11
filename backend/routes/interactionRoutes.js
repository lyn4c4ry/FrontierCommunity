const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// ── LIKE / DISLIKE ──────────────────────────────────────────────────────────
// POST /api/like  { userId, targetId, targetType, value }
// value: 1 = like, -1 = dislike
router.post('/like', async (req, res) => {
  const { userId, targetId, targetType, value } = req.body;
  if (!userId || !targetId || !targetType || ![1, -1].includes(Number(value))) {
    return res.status(400).json({ error: 'Invalid params' });
  }
  try {
    const existing = await pool.query(
      'SELECT id, value FROM likes WHERE user_id=$1 AND target_id=$2 AND target_type=$3',
      [userId, targetId, targetType]
    );
    if (existing.rows.length) {
      if (existing.rows[0].value === Number(value)) {
        // Aynı oy → kaldır (toggle)
        await pool.query('DELETE FROM likes WHERE id=$1', [existing.rows[0].id]);
      } else {
        // Farklı oy → güncelle
        await pool.query('UPDATE likes SET value=$1 WHERE id=$2', [value, existing.rows[0].id]);
      }
    } else {
      await pool.query(
        'INSERT INTO likes (user_id, target_id, target_type, value) VALUES ($1,$2,$3,$4)',
        [userId, targetId, targetType, value]
      );
    }
    const counts = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE value=1)  AS likes,
        COUNT(*) FILTER (WHERE value=-1) AS dislikes
       FROM likes WHERE target_id=$1 AND target_type=$2`,
      [targetId, targetType]
    );
    const userVoteRow = await pool.query(
      'SELECT value FROM likes WHERE user_id=$1 AND target_id=$2 AND target_type=$3',
      [userId, targetId, targetType]
    );
    res.json({
      likes:    parseInt(counts.rows[0].likes),
      dislikes: parseInt(counts.rows[0].dislikes),
      userVote: userVoteRow.rows[0]?.value ?? 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/likes/:type/:targetId?userId=
router.get('/likes/:type/:targetId', async (req, res) => {
  const { type, targetId } = req.params;
  const { userId } = req.query;
  try {
    const counts = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE value=1)  AS likes,
        COUNT(*) FILTER (WHERE value=-1) AS dislikes
       FROM likes WHERE target_id=$1 AND target_type=$2`,
      [targetId, type]
    );
    let userVote = 0;
    if (userId) {
      const uv = await pool.query(
        'SELECT value FROM likes WHERE user_id=$1 AND target_id=$2 AND target_type=$3',
        [userId, targetId, type]
      );
      userVote = uv.rows[0]?.value ?? 0;
    }
    res.json({
      likes:    parseInt(counts.rows[0].likes),
      dislikes: parseInt(counts.rows[0].dislikes),
      userVote
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── BOOKMARK ────────────────────────────────────────────────────────────────
// POST /api/bookmark  { userId, threadId }  → toggle
router.post('/bookmark', async (req, res) => {
  const { userId, threadId } = req.body;
  if (!userId || !threadId) return res.status(400).json({ error: 'Invalid params' });
  try {
    const existing = await pool.query(
      'SELECT id FROM bookmarks WHERE user_id=$1 AND thread_id=$2',
      [userId, threadId]
    );
    if (existing.rows.length) {
      await pool.query('DELETE FROM bookmarks WHERE id=$1', [existing.rows[0].id]);
      res.json({ bookmarked: false });
    } else {
      await pool.query(
        'INSERT INTO bookmarks (user_id, thread_id) VALUES ($1,$2)',
        [userId, threadId]
      );
      res.json({ bookmarked: true });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/bookmarks/:userId
router.get('/bookmarks/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, u.username
       FROM bookmarks b
       JOIN threads t ON t.id = b.thread_id
       JOIN users   u ON u.id = t.user_id
       WHERE b.user_id=$1
       ORDER BY b.created_at DESC`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;