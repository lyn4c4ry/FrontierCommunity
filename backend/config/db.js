const { Pool } = require('pg');
require('dotenv').config();

// Create a new connection pool using the connection string from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Event listener for successful database connection
pool.on('connect', () => {
  console.log('PostgreSQL: Database bridge established successfully! 🚀');
});

// Error handling for idle clients in the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
  process.exit(-1);
});

module.exports = {
  // Exported query method for use in models
  query: (text, params) => pool.query(text, params),
};