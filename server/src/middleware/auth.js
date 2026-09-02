'use strict';

const jwt = require('jsonwebtoken');

const FALLBACK_SECRET = 'gesturaweb_super_secret_key_2024';

/**
 * Resolved lazily so the value is picked up whenever dotenv has loaded,
 * regardless of module require order.
 */
function getJwtSecret() {
  return process.env.JWT_SECRET || FALLBACK_SECRET;
}

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches
 * `req.user = { id, email, role }` from the token payload.
 */
function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || req.headers.Authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      return res.status(401).json({ error: 'Missing authentication token' });
    }

    const payload = jwt.verify(token, getJwtSecret());

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Must run after `authenticate`. Rejects anyone whose role is not ADMIN.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

module.exports = { authenticate, requireAdmin, getJwtSecret };
