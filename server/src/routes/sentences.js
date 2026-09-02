'use strict';

const express = require('express');

const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * POST /api/sentences
 * Any authenticated user. Body: { text }
 */
router.post('/', (req, res) => {
  try {
    const { text } = req.body || {};

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text must be a non-empty string' });
    }

    const normalizedText = text.trim();
    const result = db
      .prepare('INSERT INTO sentences (user_id, text) VALUES (?, ?)')
      .run(req.user.id, normalizedText);
    const sentence = db
      .prepare('SELECT id, user_id, text, created_at FROM sentences WHERE id = ?')
      .get(result.lastInsertRowid);

    return res.status(201).json({ sentence });
  } catch (err) {
    console.error('[sentences/create]', err);
    return res.status(500).json({ error: 'Failed to create sentence' });
  }
});

/**
 * GET /api/sentences
 * Any authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const sentences = db
      .prepare(
        'SELECT id, user_id, text, created_at FROM sentences WHERE user_id = ? ORDER BY created_at DESC'
      )
      .all(req.user.id);

    return res.json({ sentences });
  } catch (err) {
    console.error('[sentences/list]', err);
    return res.status(500).json({ error: 'Failed to load sentences' });
  }
});

/**
 * DELETE /api/sentences/:id
 * Any authenticated user.
 */
router.delete('/:id', (req, res) => {
  try {
    const sentence = db
      .prepare('SELECT id FROM sentences WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!sentence) {
      return res.status(404).json({ error: 'Sentence not found' });
    }

    db.prepare('DELETE FROM sentences WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.user.id
    );

    return res.json({ message: 'Sentence deleted' });
  } catch (err) {
    console.error('[sentences/delete]', err);
    return res.status(500).json({ error: 'Failed to delete sentence' });
  }
});

module.exports = router;
