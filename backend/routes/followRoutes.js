const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// 1. Takipçi ve Takip Edilen Sayılarını Getir (Herkese Açık)
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

// 2. Takip Durumunu Kontrol Et (Giriş Yapmış Kullanıcı İçin)
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

// 3. Takip Et / Takibi Bırak (Toggle İşlemi)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.userId;
    const targetId = req.body.targetUserId;

    if (String(followerId) === String(targetId)) {
        return res.status(400).json({ error: 'Kendinizi takip edemezsiniz.' });
    }

    // Önce zaten takip ediyor mu diye bakıyoruz
    const check = await pool.query(
      'SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, targetId]
    );

    if (check.rows.length > 0) {
      // Ediyorsa -> Takibi Bırak (Unfollow)
      await pool.query('DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2', [followerId, targetId]);
      res.json({ isFollowing: false });
    } else {
      // Etmiyorsa -> Takip Et (Follow)
      await pool.query('INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)', [followerId, targetId]);
      res.json({ isFollowing: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;