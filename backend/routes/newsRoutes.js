const express = require('express');
const router = express.Router();

router.get('/games', async (req, res) => {
  try {
    // .env dosyasından API anahtarını alıyoruz
    const apiKey = process.env.RAWG_API_KEY;
    
    if (!apiKey) {
      console.error("HATA: .env dosyasında RAWG_API_KEY bulunamadı!");
      return res.status(500).json({ error: 'API Key eksik' });
    }

    // Frontend'den gelen filtreleri (sayfa, arama, tür vb.) URL parametrelerine dönüştürüyoruz
    const queryParams = new URLSearchParams(req.query);
    
    // Kendi gizli RAWG anahtarımızı bu parametrelere ekliyoruz
    queryParams.append('key', apiKey); 

    // RAWG API'sine gerçek isteği backend üzerinden atıyoruz
    const rawgUrl = `https://api.rawg.io/api/games?${queryParams.toString()}`;
    const response = await fetch(rawgUrl);
    
    if (!response.ok) {
      throw new Error(`RAWG API Yanıt Vermedi. Durum Kodu: ${response.status}`);
    }

    const data = await response.json();
    
    // RAWG'dan gelen veriyi frontend'e iletiyoruz
    res.json(data);

  } catch (error) {
    console.error('Oyunlar çekilirken hata oluştu:', error.message);
    res.status(500).json({ error: 'Sunucu oyunları çekerken bir sorun yaşadı.' });
  }
});

module.exports = router;