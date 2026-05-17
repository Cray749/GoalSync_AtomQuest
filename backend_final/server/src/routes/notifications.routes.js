/**
 * notifications.routes.js
 * GoalSync — Notification API routes.
 *
 * Routes:
 *   GET    /api/notifications            — get my notifications (with unread count)
 *   PATCH  /api/notifications/:id/read   — mark one as read
 *   PATCH  /api/notifications/read-all   — mark all as read
 *   DELETE /api/notifications/:id        — delete one notification
 *
 * Admin-only:
 *   POST   /api/notifications/broadcast  — send quarter-open broadcast manually
 */

'use strict';

const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const ctrl         = require('../controllers/notifications.controller');

// All notification routes require auth
router.use(authenticate);

router.get('/',                     ctrl.getMyNotifications);
router.patch('/read-all',           ctrl.markAllRead);          // must be before /:id
router.patch('/:id/read',           ctrl.markOneRead);
router.delete('/:id',               ctrl.deleteNotification);

// Admin-only broadcast
router.post('/broadcast', authorize('admin'), ctrl.broadcastQuarterOpen);

module.exports = router;
