// server/src/routes/admin.routes.js

'use strict';

const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const ctrl         = require('../controllers/admin.controller');

router.use(authenticate);
router.use(authorize('admin'));

// Cycles
router.get('/cycles',           ctrl.getCycles);
router.post('/cycles',          ctrl.createCycle);
router.put('/cycles/:id',       ctrl.updateCycle);

// Thrust areas
router.get('/thrust-areas',     ctrl.getThrustAreas);
router.post('/thrust-areas',    ctrl.createThrustArea);
router.put('/thrust-areas/:id', ctrl.updateThrustArea);

// Users
router.get('/users',            ctrl.getUsers);
router.post('/users',           ctrl.createUser);
router.put('/users/:id',        ctrl.updateUser);

// Shared goals
router.post('/shared-goals',    ctrl.pushSharedGoal);

// Goal unlock
router.post('/goals/:id/unlock', ctrl.unlockGoal);

// Dashboard + audit
router.get('/completion',       ctrl.getCompletionDashboard);
router.get('/audit-logs',       ctrl.getAuditLogs);

// Org stats for Admin Overview top stat cards (Issue 4 fix)
router.get('/stats', ctrl.getOrgStats);

// Cycle activation shortcut
router.put('/cycles/:id/activate', async (req, res) => {
  req.body = { is_active: true };
  return ctrl.updateCycle(req, res);
});

// User management shortcuts
router.put('/users/:id/deactivate', async (req, res) => {
  req.body = { is_active: false };
  return ctrl.updateUser(req, res);
});

router.put('/users/:id/manager', async (req, res) => {
  // req.body already has { manager_id }
  return ctrl.updateUser(req, res);
});

// Thrust area delete
router.delete('/thrust-areas/:id', async (req, res) => {
  try {
    const { query } = require('../config/db');
    const { sendSuccess, sendError } = require('../utils/response');
    await query('UPDATE thrust_areas SET is_active = FALSE WHERE id = $1', [req.params.id]);
    return sendSuccess(res, null, 'Thrust area deleted');
  } catch (err) {
    const { sendError } = require('../utils/response');
    return sendError(res, err.message, 500);
  }
});

module.exports = router;
