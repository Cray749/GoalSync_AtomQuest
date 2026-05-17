// server/src/routes/auth.routes.js

'use strict';

const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const {
  login,
  me,
  logout,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/auth.controller');

// Public
router.post('/login', login);

// Protected
router.get('/me',                            authenticate, me);
router.post('/logout',                       authenticate, logout);
router.get('/notifications',                 authenticate, getNotifications);
router.put('/notifications/read-all',        authenticate, markAllNotificationsRead);
router.put('/notifications/:id/read',        authenticate, markNotificationRead);

module.exports = router;
