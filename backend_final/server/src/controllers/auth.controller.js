// server/src/controllers/auth.controller.js

'use strict';

const bcrypt      = require('bcrypt');
const jwt         = require('jsonwebtoken');
const { query }   = require('../config/db');
const {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendError,
} = require('../utils/response');

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function buildToken(user) {
  const payload = {
    id:         user.id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    department: user.department,
    manager_id: user.manager_id,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

// ──────────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendBadRequest(res, 'Email and password are required');
    }

    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE LIMIT 1',
      [email.toLowerCase().trim()]
    );

    const user = rows[0];

    if (!user) {
      // Intentionally vague — don't reveal whether email exists
      return sendUnauthorized(res, 'Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return sendUnauthorized(res, 'Invalid email or password');
    }

    const token = buildToken(user);

    return sendSuccess(res, {
      token,
      user: sanitizeUser(user),
    }, 'Login successful');
  } catch (err) {
    console.error('[Auth] login error:', err);
    return sendError(res, 'Login failed', 500, err.message);
  }
}

// ──────────────────────────────────────────────
// GET /api/auth/me
// ──────────────────────────────────────────────
async function me(req, res) {
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.role, u.department,
              u.manager_id, u.is_active, u.created_at,
              m.name AS manager_name
       FROM users u
       LEFT JOIN users m ON m.id = u.manager_id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [req.user.id]
    );

    if (!rows[0]) {
      return sendUnauthorized(res, 'User account not found or deactivated');
    }

    return sendSuccess(res, rows[0], 'Profile fetched');
  } catch (err) {
    console.error('[Auth] me error:', err);
    return sendError(res, 'Could not fetch profile', 500, err.message);
  }
}

// ──────────────────────────────────────────────
// POST /api/auth/logout
// JWT is stateless; we just acknowledge the logout client-side.
// In production you'd maintain a token blocklist in Redis.
// ──────────────────────────────────────────────
async function logout(req, res) {
  // Optionally log the logout event
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, ip_address)
       VALUES ($1, 'user_logout', $2)`,
      [req.user.id, req.ip]
    );
  } catch (_) { /* non-critical */ }

  return sendSuccess(res, null, 'Logged out successfully');
}

// ──────────────────────────────────────────────
// GET /api/auth/notifications
// ──────────────────────────────────────────────
async function getNotifications(req, res) {
  try {
    const { rows } = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    return sendSuccess(res, rows, 'Notifications fetched');
  } catch (err) {
    return sendError(res, 'Could not fetch notifications', 500, err.message);
  }
}

// ──────────────────────────────────────────────
// PUT /api/auth/notifications/:id/read
// ──────────────────────────────────────────────
async function markNotificationRead(req, res) {
  try {
    const { rows } = await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return sendError(res, 'Notification not found', 404);
    return sendSuccess(res, rows[0], 'Marked as read');
  } catch (err) {
    return sendError(res, 'Could not update notification', 500, err.message);
  }
}

// ──────────────────────────────────────────────
// PUT /api/auth/notifications/read-all
// ──────────────────────────────────────────────
async function markAllNotificationsRead(req, res) {
  try {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [req.user.id]
    );
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    return sendError(res, 'Could not update notifications', 500, err.message);
  }
}

module.exports = {
  login,
  me,
  logout,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
