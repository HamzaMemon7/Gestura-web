'use strict';

const express = require('express');

const supabase = require('../db');
const {
  authenticate,
  requireAdmin
} = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/*
GET /api/gestures
*/
router.get('/', async (req, res) => {
  try {
    const { data: gestures, error } = await supabase
      .from('gestures')
      .select('id, name, landmarks_json, created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({
      gestures
    });

  } catch (err) {
    console.error('[gestures/list]', err);

    return res.status(500).json({
      error: 'Failed to load gestures'
    });
  }
});

/*
POST /api/gestures
Admin only
*/
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      landmarks_json: landmarksJson
    } = req.body || {};

    if (
      !name ||
      landmarksJson === undefined ||
      landmarksJson === null ||
      landmarksJson === ''
    ) {
      return res.status(400).json({
        error: 'name and landmarks_json are required'
      });
    }

    const serialized =
      typeof landmarksJson === 'string'
        ? landmarksJson
        : JSON.stringify(landmarksJson);

    const { data: gesture, error } = await supabase
      .from('gestures')
      .insert({
        name: String(name).trim(),
        landmarks_json: serialized
      })
      .select('id, name, landmarks_json, created_at')
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      gesture
    });

  } catch (err) {
    console.error('[gestures/create]', err);

    return res.status(500).json({
      error: 'Failed to create gesture'
    });
  }
});

/*
DELETE /api/gestures/:id
*/
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid gesture id'
      });
    }

    const { data, error } = await supabase
      .from('gestures')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        error: 'Gesture not found'
      });
    }

    return res.json({
      message: 'Gesture deleted'
    });

  } catch (err) {
    console.error('[gestures/delete]', err);

    return res.status(500).json({
      error: 'Failed to delete gesture'
    });
  }
});

module.exports = router;