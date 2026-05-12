const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route   POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await User.create(username, email, hashedPassword);
    res.status(201).json({ message: 'User registered successfully!', user: newUser });
  } catch (err) {
    console.error('Registration Error:', err.message);
    res.status(500).json({ message: 'Server Error during registration.' });
  }
});

/**
 * @route   POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
    message: 'Login successful!',
    token,
    user: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url }
  });
  } catch (err) {
    console.error('Login Error:', err.message);
    res.status(500).json({ message: 'Server Error during login.' });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile — userId JWT'den alınır, body'den değil
 */
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { username, bio, avatar_url } = req.body;

    let updateFields = [];
    let values = [];
    let counter = 1;

    if (username !== undefined && username.trim() !== '') {
      updateFields.push(`username = $${counter++}`);
      values.push(username.trim());
    }
    if (bio !== undefined) {
      updateFields.push(`bio = $${counter++}`);
      values.push(bio);
    }
    if (avatar_url !== undefined) {
      updateFields.push(`avatar_url = $${counter++}`);
      values.push(avatar_url === '' ? null : avatar_url);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(userId);

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${counter}
      RETURNING id, username, email, bio, avatar_url
    `;

    const { rows } = await db.query(query, values);
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Profile updated successfully!', user: rows[0] });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * @route   GET /api/auth/profile/:userId
 */
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const userResult = await db.query(
      `SELECT id, username, email, avatar_url, bio, created_at FROM users WHERE id = $1`,
      [userId]
    );
    if (!userResult.rows[0]) return res.status(404).json({ message: 'User not found' });

    const user = userResult.rows[0];

    const threadResult  = await db.query(`SELECT COUNT(*) AS count FROM threads  WHERE user_id = $1`, [userId]);
    const commentResult = await db.query(`SELECT COUNT(*) AS count FROM comments WHERE user_id = $1`, [userId]);

    const threadCount  = parseInt(threadResult.rows[0].count);
    const commentCount = parseInt(commentResult.rows[0].count);

    const rankResult = await db.query(
      `SELECT rank FROM (
         SELECT u.id, RANK() OVER (ORDER BY (COUNT(DISTINCT t.id) + COUNT(DISTINCT c.id)) DESC) AS rank
         FROM users u
         LEFT JOIN threads  t ON t.user_id = u.id
         LEFT JOIN comments c ON c.user_id = u.id
         GROUP BY u.id
       ) ranked WHERE id = $1`,
      [userId]
    );

    const streakResult = await db.query(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS streak_days
       FROM (
         SELECT created_at FROM threads  WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         UNION ALL
         SELECT created_at FROM comments WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       ) activity`,
      [userId]
    );

    const level = Math.max(1, Math.floor((threadCount + commentCount) / 5));

    res.json({
      id:            user.id,
      username:      user.username,
      email:         user.email,
      avatar_url:    user.avatar_url || null,
      bio:           user.bio        || '',
      created_at:    user.created_at,
      thread_count:  threadCount,
      comment_count: commentCount,
      level,
      rank:          rankResult.rows[0]?.rank || null,
      streak:        parseInt(streakResult.rows[0].streak_days) || 0,
    });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

/**
 * @route   GET /api/auth/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users)                              AS member_count,
        (SELECT COUNT(*) FROM threads)                           AS thread_count,
        (SELECT COUNT(*) FROM comments WHERE is_deleted = FALSE) AS reply_count
    `);
    const row = result.rows[0];
    res.json({
      members: parseInt(row.member_count),
      threads: parseInt(row.thread_count),
      replies: parseInt(row.reply_count)
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ message: 'Stats could not be loaded' });
  }
});

/**
 * @route   PUT /api/auth/password
 * @desc    Change password — userId JWT'den alınır
 */
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

    res.json({ message: 'Password updated successfully!' });
  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete own account — userId JWT'den alınır
 */
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Password is incorrect.' });

    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Account delete error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * @route   POST /api/auth/reset-password-demo
 * @desc    Demo reset — no JWT, email + new password only
 */
router.post('/reset-password-demo', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!result.rows[0]) {
      // Don't reveal whether email exists
      return res.json({ message: 'Password updated successfully!' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, result.rows[0].id]);

    res.json({ message: 'Password updated successfully!' });
  } catch (err) {
    console.error('Demo reset error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;