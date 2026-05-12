const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { createNotification } = require('./notificationRoutes');

// GET all comments for a thread — public
router.get('/:threadId', async (req, res) => {
  try {
    // GÜNCELLEME: u.avatar_url SQL sorgusuna eklendi
    const result = await pool.query(
      `SELECT c.id, c.thread_id, c.user_id, c.content, c.parent_id,
              c.is_deleted, c.created_at AT TIME ZONE 'UTC' as created_at, 
              u.username, u.avatar_url
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.thread_id=$1 ORDER BY c.created_at ASC`,
      [req.params.threadId]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all comments by a specific user — public
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    // GÜNCELLEME: u.avatar_url SQL sorgusuna eklendi
    const result = await pool.query(
      `SELECT c.*, u.username, u.avatar_url 
       FROM comments c JOIN users u ON u.id=c.user_id
       WHERE c.user_id=$1 AND c.is_deleted=FALSE ORDER BY c.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST a new comment or reply — requires auth
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { threadId, content, parentId } = req.body;
  if (!threadId || !content?.trim()) return res.status(400).json({ error: 'Missing fields' });
  try {
    const result = await pool.query(
      `INSERT INTO comments (thread_id, user_id, content, parent_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [threadId, userId, content.trim(), parentId || null]
    );
    const newComment = result.rows[0];

    // --- Notification: reply ---
// Thread sahibini bul
const threadOwner = await pool.query(
  `SELECT user_id FROM threads WHERE id = $1`, [threadId]
);
if (threadOwner.rows.length > 0) {
  await createNotification({
    userId:   threadOwner.rows[0].user_id,
    actorId:  userId,
    type:     'reply',
    refId:    newComment.id,
    refType:  'comment'
  });
}

// Eğer parentId varsa parent comment sahibini de bildir
if (parentId) {
  const parentOwner = await pool.query(
    `SELECT user_id FROM comments WHERE id = $1`, [parentId]
  );
  if (parentOwner.rows.length > 0 && parentOwner.rows[0].user_id !== threadOwner.rows[0]?.user_id) {
    await createNotification({
      userId:   parentOwner.rows[0].user_id,
      actorId:  userId,
      type:     'reply',
      refId:    newComment.id,
      refType:  'comment'
    });
  }
}

// --- Notification: mention (@username) ---
const mentions = content.match(/@(\w+)/g);
if (mentions) {
  for (const mention of mentions) {
    const uname = mention.slice(1);
    const mentioned = await pool.query(
      `SELECT id FROM users WHERE username ILIKE $1`, [uname]
    );
    if (mentioned.rows.length > 0) {
      await createNotification({
        userId:   mentioned.rows[0].id,
        actorId:  userId,
        type:     'mention',
        refId:    newComment.id,
        refType:  'comment'
      });
    }
  }
}

    // GÜNCELLEME: Hatalı olan c.thread_id sorgusu c.id olarak düzeltildi.
    const full = await pool.query(
      `SELECT c.*, u.username, u.avatar_url 
       FROM comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.id = $1`,
      [result.rows[0].id]
    );
    res.status(201).json(full.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (soft) a comment — requires auth, owner only
router.delete('/:commentId', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { commentId } = req.params;
  try {
    const check = await pool.query('SELECT user_id FROM comments WHERE id=$1', [commentId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Not found' });
    if (String(check.rows[0].user_id) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });
    await pool.query("UPDATE comments SET is_deleted=TRUE, content='[deleted]' WHERE id=$1", [commentId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;