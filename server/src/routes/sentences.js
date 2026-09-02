'use strict';

const express = require('express');

const supabase = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/*
POST /api/sentences
*/
router.post('/', async (req, res) => {
  try {
    const { text } = req.body || {};

    if (
      typeof text !== 'string' ||
      !text.trim()
    ) {
      return res.status(400).json({
        error: 'text must be a non-empty string'
      });
    }

    const { data: sentence, error } = await supabase
      .from('sentences')
      .insert({
        user_id: req.user.id,
        text: text.trim()
      })
      .select('id, user_id, text, created_at')
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      sentence
    });

  } catch (err) {
    console.error('[sentences/create]', err);

    return res.status(500).json({
      error: 'Failed to create sentence'
    });
  }
});

/*
GET /api/sentences
*/
router.get('/', async (req, res) => {
  try {
    const { data: sentences, error } = await supabase
      .from('sentences')
      .select('id, user_id, text, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', {
        ascending: false
      });

    if (error) {
      throw error;
    }

    return res.json({
      sentences
    });

  } catch (err) {
    console.error('[sentences/list]', err);

    return res.status(500).json({
      error: 'Failed to load sentences'
    });
  }
});

/*
DELETE /api/sentences/:id
*/
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid sentence id'
      });
    }

    const { data, error } = await supabase
      .from('sentences')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        error: 'Sentence not found'
      });
    }

    return res.json({
      message: 'Sentence deleted'
    });

  } catch (err) {
    console.error('[sentences/delete]', err);

    return res.status(500).json({
      error: 'Failed to delete sentence'
    });
  }
});

module.exports = router;