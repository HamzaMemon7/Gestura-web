'use strict';

const express = require('express');

const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * POST /api/translate
 * Any authenticated user. Body: { text, targetLang }
 */
router.post('/', async (req, res) => {
  try {
    const { text } = req.body || {};
    const targetLang = req.body?.targetLang === undefined ? 'es' : req.body.targetLang;

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text must be a non-empty string' });
    }

    if (typeof targetLang !== 'string' || !/^[A-Za-z]{2}$/.test(targetLang)) {
      return res.status(400).json({ error: 'targetLang must be a 2-letter string' });
    }

    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );

    if (!response.ok) {
      throw new Error(`Translation service returned ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data[0].map((segment) => segment[0]).join('');

    return res.json({ translatedText });
  } catch (err) {
    console.error('[translate/create]', err);
    return res.status(502).json({ error: 'Translation service unavailable' });
  }
});

module.exports = router;
