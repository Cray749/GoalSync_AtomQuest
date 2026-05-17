// server/src/routes/goals.routes.js

'use strict';

const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const ctrl         = require('../controllers/goals.controller');

// All goal routes require authentication
router.use(authenticate);

// ── Utility endpoints (order matters — must be before /:id) ──
router.get('/cycle',        ctrl.getActiveCycle);
router.get('/thrust-areas', ctrl.getThrustAreas);
router.post('/submit',      authorize('employee', 'manager'), ctrl.submitGoals);

// ── CRUD ──────────────────────────────────────────────────────
router.get('/',    authorize('employee', 'manager'), ctrl.getMyGoals);
router.post('/',   authorize('employee', 'manager'), ctrl.createGoal);
router.get('/:id', ctrl.getGoalById);                            // employee/manager/admin
router.put('/:id', authorize('employee', 'manager'), ctrl.updateGoal);
router.delete('/:id', authorize('employee', 'manager'), ctrl.deleteGoal);

module.exports = router;
