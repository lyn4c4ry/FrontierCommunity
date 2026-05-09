const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const db = require('../config/db');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user and hash their password
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

    res.status(201).json({
      message: 'User registered successfully!',
      user: newUser
    });
  } catch (err) {
    console.error('Registration Error:', err.message);
    res.status(500).json({ message: 'Server Error during registration.' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user, verify password, and return a JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error('Login Error:', err.message);
    res.status(500).json({ message: 'Server Error during login.' });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile (bio, avatar_url, username)
 */
router.put('/profile', async (req, res) => {
  try {
    const { userId, username, bio, avatar_url } = req.body;

    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const { rows } = await db.query(
      `UPDATE users
       SET
         username   = COALESCE($1, username),
         bio        = COALESCE($2, bio),
         avatar_url = COALESCE($3, avatar_url)
       WHERE id = $4
       RETURNING id, username, email, bio, avatar_url`,
      [username || null, bio || null, avatar_url || null, userId]
    );

    if (!rows[0]) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Profile updated successfully!', user: rows[0] });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * @route   GET /api/auth/profile/:userId
 * @desc    Get user profile with full stats (thread count, comment count, level, rank, streak)
 */
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // 1) Fetch base user info
    const userResult = await db.query(
      `SELECT id, username, email, avatar_url, bio, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // 2) Total thread count
    const threadResult = await db.query(
      `SELECT COUNT(*) AS count FROM threads WHERE user_id = $1`,
      [userId]
    );

    // 3) Total comment count
    const commentResult = await db.query(
      `SELECT COUNT(*) AS count FROM comments WHERE user_id = $1`,
      [userId]
    );

    const threadCount  = parseInt(threadResult.rows[0].count);
    const commentCount = parseInt(commentResult.rows[0].count);

    // 4) Rank — position among all users by total activity (threads + comments)
    const rankResult = await db.query(
      `SELECT rank FROM (
         SELECT
           u.id,
           RANK() OVER (
             ORDER BY (COUNT(DISTINCT t.id) + COUNT(DISTINCT c.id)) DESC
           ) AS rank
         FROM users u
         LEFT JOIN threads  t ON t.user_id = u.id
         LEFT JOIN comments c ON c.user_id = u.id
         GROUP BY u.id
       ) ranked
       WHERE id = $1`,
      [userId]
    );

    // 5) Streak — number of distinct active days in the last 30 days
    const streakResult = await db.query(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS streak_days
       FROM (
         SELECT created_at FROM threads  WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         UNION ALL
         SELECT created_at FROM comments WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       ) activity`,
      [userId]
    );

    // 6) Level — 1 level per every 5 activities
    const totalActivity = threadCount + commentCount;
    const level = Math.max(1, Math.floor(totalActivity / 5));

    res.json({
      id:            user.id,
      username:      user.username,
      email:         user.email,
      avatar_url:    user.avatar_url || null,
      bio:           user.bio        || '',
      created_at:    user.created_at,

      thread_count:  threadCount,
      comment_count: commentCount,
      level:         level,
      rank:          rankResult.rows[0]?.rank || null,
      streak:        parseInt(streakResult.rows[0].streak_days) || 0,
    });

  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

module.exports = router;