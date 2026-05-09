const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 1. Route Imports
const authRoutes = require('./routes/authRoutes');
const threadRoutes = require('./routes/threadRoutes');
const commentRoutes = require('./routes/commentRoutes'); // Import
const newsRoutes = require('./routes/newsRoutes');

const app = express();

// 2. Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse incoming JSON requests
app.use('/api/news', newsRoutes);

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