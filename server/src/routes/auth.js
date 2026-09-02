'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const supabase = require('../db');
const { authenticate, getJwtSecret } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 10;
const TOKEN_TTL = '7d';

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    getJwtSecret(),
    {
      expiresIn: TOKEN_TTL
    }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

/*
POST /api/auth/register
*/
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'name, email and password are required'
      });
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const { data: existingUser, error: existingError } =
      await supabase
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    const passwordHash = await bcrypt.hash(
      String(password),
      SALT_ROUNDS
    );

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name: String(name).trim(),
        email: normalizedEmail,
        password_hash: passwordHash,
        role: 'USER'
      })
      .select('id, name, email, role')
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      token: signToken(user),
      user: publicUser(user)
    });

  } catch (err) {
    console.error('[auth/register]', err);

    return res.status(500).json({
      error: 'Failed to register user'
    });
  }
});

/*
POST /api/auth/login
*/
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: 'email and password are required'
      });
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password_hash, role')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const passwordMatches = await bcrypt.compare(
      String(password),
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    return res.json({
      token: signToken(user),
      user: publicUser(user)
    });

  } catch (err) {
    console.error('[auth/login]', err);

    return res.status(500).json({
      error: 'Failed to log in'
    });
  }
});

/*
GET /api/auth/me
*/
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    return res.json({
      user: publicUser(user)
    });

  } catch (err) {
    console.error('[auth/me]', err);

    return res.status(500).json({
      error: 'Failed to load current user'
    });
  }
});

module.exports = router;