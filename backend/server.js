require('@dotenvx/dotenvx').config(); // ← EN ÜSTE, her şeyden önce

const express = require('express');
const cors = require('cors');

const authRoutes         = require('./routes/authRoutes');
const threadRoutes       = require('./routes/threadRoutes');
const commentRoutes      = require('./routes/commentRoutes');
const newsRoutes         = require('./routes/newsRoutes');
const interactionRoutes  = require('./routes/interactionRoutes');
const searchRoutes       = require('./routes/searchRoutes');
const followRoutes       = require('./routes/followRoutes');
const { router: notificationRoutes, createNotification } = require('./routes/notificationRoutes');

process.env.PGTZ = 'UTC';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/news',          newsRoutes);
app.use('/api/auth',          authRoutes);
app.use('/api/threads',       threadRoutes);
app.use('/api/comments',      commentRoutes);
app.use('/api',               interactionRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/follow',        followRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/status', (req, res) => {
  res.json({ message: "Lyna's Game Forum API is running! 🚀" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});