const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
 * @route   PUT /api/auth/profile
 * @desc    Update user profile (bio and profile picture)
 */
router.put('/profile', async (req, res) => {
  try {
    const { userId, bio, profile_picture } = req.body;
    
    const query = `
      UPDATE users 
      SET bio = $1, profile_picture = $2 
      WHERE id = $3 
      RETURNING id, username, email, bio, profile_picture;
    `;
    
    const { rows } = await db.query(query, [bio, profile_picture, userId]);
    res.json({ message: "Profile updated!", user: rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user, verify password, and return a JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Verify password match using bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Create and sign a JSON Web Token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'secretkey', // Falls back to 'secretkey' if .env is missing it
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

module.exports = router;