const db = require('../config/db');

const Thread = {
  /**
   * Save a new thread to the database
   */
  create: async (title, content, userId) => {
    const query = `
      INSERT INTO threads (title, content, user_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [title, content, userId]);
    return rows[0];
  },

  /**
   * Fetch all threads with author usernames
   */
  getAll: async () => {
    const query = `
      SELECT threads.*, users.username 
      FROM threads 
      JOIN users ON threads.user_id = users.id 
      ORDER BY threads.created_at DESC;
    `;
    const { rows } = await db.query(query);
    return rows;
  }
};

module.exports = Thread;