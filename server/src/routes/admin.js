'use strict';

const express = require('express');

const supabase = require('../db');

const {
  authenticate,
  requireAdmin
} = require('../middleware/auth');

const router = express.Router();

/*
GET /api/admin/stats
*/
router.get(
  '/stats',
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {

      const [
        usersResult,
        gesturesResult,
        detectionsResult
      ] = await Promise.all([
        supabase
          .from('users')
          .select('*', {
            count: 'exact',
            head: true
          }),

        supabase
          .from('gestures')
          .select('*', {
            count: 'exact',
            head: true
          }),

        supabase
          .from('detections')
          .select('*', {
            count: 'exact',
            head: true
          })
      ]);

      if (usersResult.error) {
        throw usersResult.error;
      }

      if (gesturesResult.error) {
        throw gesturesResult.error;
      }

      if (detectionsResult.error) {
        throw detectionsResult.error;
      }

      return res.json({
        totalUsers: usersResult.count || 0,
        totalGestures: gesturesResult.count || 0,
        totalDetections: detectionsResult.count || 0
      });

    } catch (err) {
      console.error('[admin/stats]', err);

      return res.status(500).json({
        error: 'Failed to load statistics'
      });
    }
  }
);

module.exports = router;