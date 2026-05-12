const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { createNotification } = require('./notificationRoutes');

// GET /api/follow/stats/:userId — Public
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const followers = await pool.query('SELECT COUNT(*) FROM user_follows WHERE following_id = $1', [userId]);
    const following = await pool.query('SELECT COUNT(*) FROM user_follows WHERE follower_id = $1', [userId]);
    res.json({
      followers: parseInt(followers.rows[0].count),
      following: parseInt(following.rows[0].count)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/follow/check/:targetUserId — Auth required
router.get('/check/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.userId;
    const targetId = req.params.targetUserId;
    const check = await pool.query(
      'SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, targetId]
    );
    res.json({ isFollowing: check.rows.length > 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/follow/followers/:userId — Public
router.get('/followers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.username, u.avatar_url
       FROM user_follows uf
       JOIN users u ON u.id = uf.follower_id
       WHERE uf.following_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/follow/following/:userId — Public
router.get('/following/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.username, u.avatar_url
       FROM user_follows uf
       JOIN users u ON u.id = uf.following_id
       WHERE uf.follower_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/follow — Toggle follow/unfollow — Auth required
router.post('/', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.userId;
    const targetId = req.body.targetUserId;

    if (String(followerId) === String(targetId)) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    const check = await pool.query(
      'SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, targetId]
    );

    if (check.rows.length > 0) {
      await pool.query(
        'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2',
        [followerId, targetId]
      );
      res.json({ isFollowing: false });
    } else {
      await pool.query(
        'INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)',
        [followerId, targetId]
      );

      // Takip bildirimi gönder (hata follow işlemini engellemesin)
      try {
        await createNotification({
          userId:  targetId,   // takip edilen
          actorId: followerId, // takip eden
          type:    'follow',
          refId:   null,
          refType: null
        });
      } catch (notifErr) {
        console.error('Notification error:', notifErr.message);
      }

      res.json({ isFollowing: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;