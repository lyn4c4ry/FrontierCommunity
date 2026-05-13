const express = require('express');
const router = express.Router();

router.get('/games', async (req, res) => {
  try {
    const apiKey = process.env.RAWG_API_KEY;

    if (!apiKey) {
      console.error('RAWG_API_KEY not found in .env');
      return res.status(500).json({ error: 'API key missing' });
    }

    const queryParams = new URLSearchParams(req.query);

    // Remove ordering when search is active — RAWG ignores relevance and returns unrelated results otherwise
    if (queryParams.get('search')?.trim()) {
      queryParams.delete('ordering');
    }

    queryParams.append('key', apiKey);

    const rawgUrl = `https://api.rawg.io/api/games?${queryParams.toString()}`;
    const response = await fetch(rawgUrl);

    if (!response.ok) {
      throw new Error(`RAWG API error — status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Failed to fetch games:', error.message);
    res.status(500).json({ error: 'Server failed to fetch games.' });
  }
});

module.exports = router;