const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { createNotification } = require('./notificationRoutes');

// ── LIKE / DISLIKE ──────────────────────────────────────────────────────────
// POST /api/like  { targetId, targetType, value }
// value: 1 = like, -1 = dislike
router.post('/like', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { targetId, targetType, value } = req.body;

  if (!targetId || !['thread', 'comment'].includes(targetType) || ![1, -1].includes(Number(value))) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    await pool.query('BEGIN');

    const existing = await pool.query(
      'SELECT id, value FROM likes WHERE user_id=$1 AND target_id=$2 AND target_type=$3',
      [userId, targetId, targetType]
    );

    if (existing.rows.length) {
      if (existing.rows[0].value === Number(value)) {
        // Same vote — toggle off (remove)
        await pool.query('DELETE FROM likes WHERE id=$1', [existing.rows[0].id]);
      } else {
        // Different vote — update existing row
        await pool.query('UPDATE likes SET value=$1 WHERE id=$2', [value, existing.rows[0].id]);
      }
    } else {
      // No prior vote — insert new row
      await pool.query(
        'INSERT INTO likes (user_id, target_id, target_type, value) VALUES ($1,$2,$3,$4)',
        [userId, targetId, targetType, value]
      );
    }

    // --- Notification: like ---
    if (value === 1) {
      let ownerId;
      if (targetType === 'thread') {
        const r = await pool.query(`SELECT user_id FROM threads WHERE id=$1`, [targetId]);
        ownerId = r.rows[0]?.user_id;
      } else {
        const r = await pool.query(`SELECT user_id FROM comments WHERE id=$1`, [targetId]);
        ownerId = r.rows[0]?.user_id;
      }
      if (ownerId) {
        await createNotification({
          userId:   ownerId,
          actorId:  userId,
          type:     'like',
          refId:    targetId,
          refType:  targetType
        });
      }
    }
    
    await pool.query('COMMIT');

    // Return updated counts after the operation
    const counts = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE value=1)  AS likes,
        COUNT(*) FILTER (WHERE value=-1) AS dislikes
       FROM likes WHERE target_id=$1 AND target_type=$2`,
      [targetId, targetType]
    );

    // Return the current user's vote status
    const userVoteRow = await pool.query(
      'SELECT value FROM likes WHERE user_id=$1 AND target_id=$2 AND target_type=$3',
      [userId, targetId, targetType]
    );

    res.json({
      likes: parseInt(counts.rows[0].likes) || 0,
      dislikes: parseInt(counts.rows[0].dislikes) || 0,
      userVote: userVoteRow.rows[0]?.value ?? 0
    });

  } catch (e) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error during like operation' });
  }
});

// GET /api/likes/:type/:targetId
// Returns like/dislike counts and the requesting user's vote for a single target
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
    if (userId && userId !== 'undefined') {
      const uv = await pool.query(
        'SELECT value FROM likes WHERE user_id=$1 AND target_id=$2 AND target_type=$3',
        [userId, targetId, type]
      );
      userVote = uv.rows[0]?.value ?? 0;
    }

    res.json({
      likes: parseInt(counts.rows[0].likes) || 0,
      dislikes: parseInt(counts.rows[0].dislikes) || 0,
      userVote
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch interaction counts' });
  }
});

// ── BATCH LIKES ─────────────────────────────────────────────────────────────
// POST /api/likes/batch  { threadIds: [1,2,3,...], userId? }
// Fetches like/dislike counts and user vote for multiple threads in a single query.
// Used on page load to pre-populate counts without N individual requests.
router.post('/likes/batch', async (req, res) => {
  const { threadIds, userId, targetType = 'thread' } = req.body;

  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return res.status(400).json({ error: 'threadIds array required' });
  }

  // Cap at 100 threads per batch request
  const ids = threadIds.slice(0, 100).map(Number).filter(n => !isNaN(n));

  try {
    // Fetch counts for all requested thread ids in one query
    const countsResult = await pool.query(
      `SELECT 
        target_id,
        COUNT(*) FILTER (WHERE value=1)  AS likes,
        COUNT(*) FILTER (WHERE value=-1) AS dislikes
       FROM likes
       WHERE target_id = ANY($1) AND target_type = $2
       GROUP BY target_id`,
      [ids, targetType]
    );

    // Fetch the authenticated user's votes if userId is provided
    let userVotes = {};
    if (userId && userId !== 'undefined') {
      const votesResult = await pool.query(
        `SELECT target_id, value FROM likes
         WHERE user_id=$1 AND target_id = ANY($2) AND target_type=$3`,
        [userId, ids, targetType]
      );
      votesResult.rows.forEach(r => {
        userVotes[r.target_id] = r.value;
      });
    }

    // Build response map — default every id to zero counts
    const data = {};
    ids.forEach(id => {
      data[id] = { likes: 0, dislikes: 0, userVote: 0 };
    });
    countsResult.rows.forEach(r => {
      data[r.target_id] = {
        likes: parseInt(r.likes) || 0,
        dislikes: parseInt(r.dislikes) || 0,
        userVote: userVotes[r.target_id] ?? 0
      };
    });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Batch likes fetch failed' });
  }
});

// ── BOOKMARK ────────────────────────────────────────────────────────────────
// POST /api/bookmark  { threadId }
// Toggles bookmark on/off for the authenticated user
router.post('/bookmark', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { threadId } = req.body;

  if (!threadId) return res.status(400).json({ error: 'Thread ID is required' });

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
    res.status(500).json({ error: 'Bookmark toggle failed' });
  }
});

// GET /api/bookmarks/:userId
// Returns all threads bookmarked by the given user
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
    res.status(500).json({ error: 'Could not retrieve bookmarks' });
  }
});

module.exports = router;