'use strict';

const express = require('express');

const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/admin/stats
 * Admin only.
 */
router.get('/stats', authenticate, requireAdmin, (req, res) => {
  try {
    const { count: totalUsers } = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const { count: totalGestures } = db.prepare('SELECT COUNT(*) as count FROM gestures').get();
    const { count: totalDetections } = db
      .prepare('SELECT COUNT(*) as count FROM detections')
      .get();

    return res.json({ totalUsers, totalGestures, totalDetections });
  } catch (err) {
    console.error('[admin/stats]', err);
    return res.status(500).json({ error: 'Failed to load statistics' });
  }
});

module.exports = router;
