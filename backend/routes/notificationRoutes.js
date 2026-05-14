const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/notifications/unread-count — must be before GET / to avoid route conflicts
router.get('/unread-count', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/notifications — fetch last 30 notifications for current user
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `SELECT n.id, n.type, n.ref_id, n.ref_type, n.read, n.created_at,
              u.username AS actor_username, u.avatar_url AS actor_avatar,
              CASE
                WHEN n.type = 'reply'   AND n.ref_type = 'thread'  THEN t.title
                WHEN n.type = 'reply'   AND n.ref_type = 'comment' THEN t2.title
                WHEN n.type = 'like'    AND n.ref_type = 'thread'  THEN t.title
                WHEN n.type = 'like'    AND n.ref_type = 'comment' THEN t2.title
                ELSE NULL
              END AS ref_title,
              CASE
                WHEN n.ref_type = 'comment' THEN c.thread_id
                ELSE NULL
              END AS comment_thread_id
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       LEFT JOIN threads t  ON n.ref_type = 'thread'  AND t.id  = n.ref_id
       LEFT JOIN comments c ON n.ref_type = 'comment' AND c.id  = n.ref_id
       LEFT JOIN threads t2 ON n.ref_type = 'comment' AND t2.id = c.thread_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/read-all — must be before PUT /read/:id to avoid route conflicts
router.put('/read-all', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  try {
    await pool.query(
      `UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/read/:id — mark a single notification as read
router.put('/read/:id', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/clear-all — delete all notifications for current user
router.delete('/clear-all', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  try {
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function — imported and used by other routes to create notifications
async function createNotification({ userId, actorId, type, refId, refType }) {
  // Do not send a notification to yourself
  if (userId === actorId) return;
  try {
    // Prevent duplicate like notifications
    if (type === 'like') {
      const existing = await pool.query(
        `SELECT id FROM notifications WHERE user_id=$1 AND actor_id=$2 AND type=$3 AND ref_id=$4 AND ref_type=$5`,
        [userId, actorId, type, refId, refType]
      );
      if (existing.rows.length > 0) return;
    }
    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, ref_id, ref_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, actorId, type, refId, refType]
    );
  } catch (err) {
    console.error('createNotification error:', err);
  }
}

module.exports = { router, createNotification };