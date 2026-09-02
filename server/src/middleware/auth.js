'use strict';

const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing');
  }

  return process.env.JWT_SECRET;
}

function authenticate(req, res, next) {
  try {
    const header =
      req.headers.authorization ||
      req.headers.Authorization ||
      '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or malformed Authorization header'
      });
    }

    const token = header
      .slice('Bearer '.length)
      .trim();

    if (!token) {
      return res.status(401).json({
        error: 'Missing authentication token'
      });
    }

    const payload = jwt.verify(
      token,
      getJwtSecret()
    );

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role
    };

    return next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired'
      });
    }

    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
}

function requireAdmin(req, res, next) {
  if (
    !req.user ||
    req.user.role !== 'ADMIN'
  ) {
    return res.status(403).json({
      error: 'Admin access required'
    });
  }

  return next();
}

module.exports = {
  authenticate,
  requireAdmin,
  getJwtSecret
};