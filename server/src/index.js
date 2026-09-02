'use strict';

const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
});

const express = require('express');
const cors = require('cors');

// Initialize database
require('./db');

const authRoutes = require('./routes/auth');
const gestureRoutes = require('./routes/gestures');
const detectionRoutes = require('./routes/detections');
const adminRoutes = require('./routes/admin');
const translateRoutes = require('./routes/translate');
const sentenceRoutes = require('./routes/sentences');

const app = express();

app.use(cors({
  origin: '*'
}));

app.use(express.json({
  limit: '50mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '50mb'
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'GesturaWeb API',
    time: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/gestures', gestureRoutes);
app.use('/api/detections', detectionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/sentences', sentenceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[server]', err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON body'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload too large'
    });
  }

  return res.status(500).json({
    error: 'Internal server error'
  });
});

module.exports = app;