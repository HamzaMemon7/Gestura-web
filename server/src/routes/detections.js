'use strict';

const express = require('express');

const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * POST /api/detections
 * Any authenticated user. Body: { gesture_id, gesture_name, confidence }
 */
router.post('/', (req, res) => {
  try {
    const { gesture_id: gestureId, gesture_name: gestureName, confidence } = req.body || {};
    const validGestureId =
      gestureId === null || (Number.isInteger(gestureId) && gestureId > 0);

    if (!validGestureId) {
      return res.status(400).json({ error: 'gesture_id must be a positive integer or null' });
    }

    if (typeof gestureName !== 'string' || !gestureName.trim()) {
      return res.status(400).json({ error: 'gesture_name must be a non-empty string' });
    }

    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return res.status(400).json({ error: 'confidence must be a number between 0 and 1' });
    }

    const normalizedName = gestureName.trim();
    const result = db
      .prepare(
        'INSERT INTO detections (user_id, gesture_id, gesture_name, confidence) VALUES (?, ?, ?, ?)'
      )
      .run(req.user.id, gestureId, normalizedName, confidence);

    return res.status(201).json({
      detection: {
        id: Number(result.lastInsertRowid),
        user_id: req.user.id,
        gesture_id: gestureId,
        gesture_name: normalizedName,
        confidence,
      },
    });
  } catch (err) {
    console.error('[detections/create]', err);
    return res.status(500).json({ error: 'Failed to create detection' });
  }
});

/**
 * GET /api/detections/me
 * Any authenticated user.
 */
router.get('/me', (req, res) => {
  try {
    const detections = db
      .prepare(
        'SELECT id, gesture_name, confidence, created_at FROM detections WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
      )
      .all(req.user.id);

    return res.json({ detections });
  } catch (err) {
    console.error('[detections/me]', err);
    return res.status(500).json({ error: 'Failed to load detections' });
  }
});

module.exports = router;
