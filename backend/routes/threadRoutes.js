const express = require('express');
const router = express.Router();
const Thread = require('../models/Thread');

/**
 * @route   POST /api/threads
 * @desc    Create a new thread with debug logging
 */
router.post('/', async (req, res) => {
  try {
    const { title, content, userId } = req.body;
    
    // Log incoming data to see what's being sent
    console.log("Creating thread for User ID:", userId);

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const newThread = await Thread.create(title, content, userId);
    res.status(201).json(newThread);
  } catch (err) {
    // This will print the exact SQL or logical error in your terminal
    console.error('SERVER SIDE ERROR:', err.message);
    res.status(500).json({ message: 'Database Error', error: err.message });
  }
});

/**
 * @route   GET /api/threads
 * @desc    Get all threads
 */
router.get('/', async (req, res) => {
  try {
    const threads = await Thread.getAll();
    res.json(threads);
  } catch (err) {
    console.error('Fetch Threads Error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;