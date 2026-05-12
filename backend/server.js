const express = require('express');
const cors = require('cors');
const authMiddleware = require('./middleware/authMiddleware');

require('dotenv').config();
console.log('JWT_SECRET:', process.env.JWT_SECRET);

// 1. Route Imports
const authRoutes = require('./routes/authRoutes');
const threadRoutes = require('./routes/threadRoutes');
const commentRoutes = require('./routes/commentRoutes'); 
const newsRoutes = require('./routes/newsRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const searchRoutes = require('./routes/searchRoutes');
const followRoutes = require('./routes/followRoutes');

const app = express();


// 2. Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/news', newsRoutes); // News routes (GET latest news)
app.use('/api/auth', authRoutes); // Authentication endpoints (Register, Login)
app.use('/api/threads', threadRoutes); // Forum Thread endpoints (Create, List)  
app.use('/api/comments', commentRoutes); // Comment routes (GET by thread, POST, DELETE)
app.use('/api', interactionRoutes); // Like, Dislike, Bookmark routes
app.use('/api/search', searchRoutes); // Search endpoint (GET /api/search?q=keyword&type=all|threads|users)
app.use('/api/follow', followRoutes);

// 3. Health Check Route
app.get('/api/status', (req, res) => {
  res.json({ message: "Lyna's Game Forum API is running! 🚀" });
});

// 4. API Routes
app.use('/api/auth', authRoutes);    // Authentication endpoints (Register, Login)
app.use('/api/threads', threadRoutes); // Forum Thread endpoints (Create, List)
app.use('/api/comments', commentRoutes); // Mount

// 5. Server Configuration
const PORT = process.env.PORT || 5000;

// 6. Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});