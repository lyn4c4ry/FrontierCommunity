const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');

// Add a new comment
router.post('/', async (req, res) => {
  try {
    const { threadId, userId, content } = req.body;
    const newComment = await Comment.create(threadId, userId, content);
    res.status(201).json(newComment);
  } catch (err) {
    res.status(500).json({ message: "Error adding comment" });
  }
});

// Get comments for a specific thread
router.get('/:threadId', async (req, res) => {
  try {
    const comments = await Comment.getByThread(req.params.threadId);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "Error fetching comments" });
  }
});

module.exports = router;