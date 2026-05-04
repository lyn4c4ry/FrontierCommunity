const db = require('../config/db');

const Comment = {
  create: async (threadId, userId, content) => {
    const query = `
      INSERT INTO comments (thread_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [threadId, userId, content]);
    return rows[0];
  },

  getByThread: async (threadId) => {
    const query = `
      SELECT comments.*, users.username 
      FROM comments 
      JOIN users ON comments.user_id = users.id 
      WHERE thread_id = $1 
      ORDER BY created_at ASC;
    `;
    const { rows } = await db.query(query, [threadId]);
    return rows;
  }
};

module.exports = Comment;