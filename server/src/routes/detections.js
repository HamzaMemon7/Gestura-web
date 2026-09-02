'use strict';

const express = require('express');

const supabase = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/*
POST /api/detections
*/
router.post('/', async (req, res) => {
  try {
    const {
      gesture_id: gestureId,
      gesture_name: gestureName,
      confidence
    } = req.body || {};

    const validGestureId =
      gestureId === null ||
      (Number.isInteger(gestureId) && gestureId > 0);

    if (!validGestureId) {
      return res.status(400).json({
        error: 'gesture_id must be a positive integer or null'
      });
    }

    if (
      typeof gestureName !== 'string' ||
      !gestureName.trim()
    ) {
      return res.status(400).json({
        error: 'gesture_name must be a non-empty string'
      });
    }

    if (
      typeof confidence !== 'number' ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      return res.status(400).json({
        error: 'confidence must be a number between 0 and 1'
      });
    }

    const { data: detection, error } = await supabase
      .from('detections')
      .insert({
        user_id: req.user.id,
        gesture_id: gestureId,
        gesture_name: gestureName.trim(),
        confidence
      })
      .select('id, user_id, gesture_id, gesture_name, confidence, created_at')
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      detection
    });

  } catch (err) {
    console.error('[detections/create]', err);

    return res.status(500).json({
      error: 'Failed to create detection'
    });
  }
});

/*
GET /api/detections/me
*/
router.get('/me', async (req, res) => {
  try {
    const { data: detections, error } = await supabase
      .from('detections')
      .select('id, gesture_name, confidence, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', {
        ascending: false
      })
      .limit(20);

    if (error) {
      throw error;
    }

    return res.json({
      detections
    });

  } catch (err) {
    console.error('[detections/me]', err);

    return res.status(500).json({
      error: 'Failed to load detections'
    });
  }
});

module.exports = router;