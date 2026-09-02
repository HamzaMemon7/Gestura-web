'use strict';

const express = require('express');

const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Every gesture route requires a valid token.
router.use(authenticate);

/**
 * GET /api/gestures
 * Any authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const gestures = db
      .prepare('SELECT id, name, landmarks_json, created_at FROM gestures ORDER BY created_at DESC, id DESC')
      .all();

    return res.json({ gestures });
  } catch (err) {
    console.error('[gestures/list]', err);
    return res.status(500).json({ error: 'Failed to load gestures' });
  }
});

/**
 * POST /api/gestures
 * Admin only. Body: { name, landmarks_json }
 */
router.post('/', requireAdmin, (req, res) => {
  try {
    const { name, landmarks_json: landmarksJson } = req.body || {};

    if (!name || landmarksJson === undefined || landmarksJson === null || landmarksJson === '') {
      return res.status(400).json({ error: 'name and landmarks_json are required' });
    }

    // Accept both a JSON string and an already-parsed array/object from the client.
    const serialized =
      typeof landmarksJson === 'string' ? landmarksJson : JSON.stringify(landmarksJson);

    const result = db
      .prepare('INSERT INTO gestures (name, landmarks_json) VALUES (?, ?)')
      .run(String(name).trim(), serialized);

    return res.status(201).json({
      gesture: {
        id: Number(result.lastInsertRowid),
        name: String(name).trim(),
        landmarks_json: serialized,
      },
    });
  } catch (err) {
    console.error('[gestures/create]', err);
    return res.status(500).json({ error: 'Failed to create gesture' });
  }
});

/**
 * DELETE /api/gestures/:id
 * Admin only.
 */
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid gesture id' });
    }

    const result = db.prepare('DELETE FROM gestures WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Gesture not found' });
    }

    return res.json({ message: 'Gesture deleted' });
  } catch (err) {
    console.error('[gestures/delete]', err);
    return res.status(500).json({ error: 'Failed to delete gesture' });
  }
});

module.exports = router;
