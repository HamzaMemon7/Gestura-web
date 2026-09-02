'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../db');
const { authenticate, getJwtSecret } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 10;
const TOKEN_TTL = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 */
router.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(normalizedEmail);

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = bcrypt.hashSync(String(password), SALT_ROUNDS);

    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(String(name).trim(), normalizedEmail, passwordHash, 'USER');

    const user = {
      id: Number(result.lastInsertRowid),
      name: String(name).trim(),
      email: normalizedEmail,
      role: 'USER',
    };

    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('[auth/register]', err);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = db
      .prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?')
      .get(normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatches = bcrypt.compareSync(String(password), user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 */
router.get('/me', authenticate, (req, res) => {
  try {
    const user = db
      .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('[auth/me]', err);
    return res.status(500).json({ error: 'Failed to load current user' });
  }
});

module.exports = router;
