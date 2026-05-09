// backend/routes/newsRoutes.js
const express = require('express');
const router = express.Router();

router.get('/games', async (req, res) => {
  try {
    const apiKey = process.env.RAWG_API_KEY;
    
    // RAWG API'sine istek atıyoruz
    const rawgResponse = await fetch(`https://api.rawg.io/api/games?key=${apiKey}`);
    
    if (!rawgResponse.ok) {
      throw new Error('RAWG API yanıt vermedi');
    }

    const data = await rawgResponse.json();
    
    // Veriyi kendi frontend'imize gönderiyoruz
    res.json(data);

  } catch (error) {
    console.error('Oyunlar çekilirken hata oluştu:', error);
    res.status(500).json({ error: 'Oyun verileri alınamadı.' });
  }
});

module.exports = router;