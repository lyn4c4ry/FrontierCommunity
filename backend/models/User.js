const db = require('../config/db');

const User = {
  /**
   * Create a new user in the database
   * @param {string} username 
   * @param {string} email 
   * @param {string} passwordHash 
   * @returns {Object} The created user object
   */
  create: async (username, email, passwordHash) => {
    const query = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, created_at;
    `;
    const values = [username, email, passwordHash];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  /**
   * Find a user by their email address
   * @param {string} email 
   * @returns {Object|null} User record or null if not found
   */
  findByEmail: async (email) => {
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await db.query(query, [email]);
    return rows[0];
  }
};

module.exports = User;