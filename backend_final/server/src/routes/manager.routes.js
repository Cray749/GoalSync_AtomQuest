// server/src/routes/manager.routes.js

'use strict';

const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const ctrl         = require('../controllers/manager.controller');

router.use(authenticate);
router.use(authorize('manager', 'admin'));

router.get('/team',                               ctrl.getTeam);
router.get('/team/:employee_id/goals',            ctrl.getEmployeeGoals);
router.put('/goals/:id/approve',                  ctrl.approveGoal);
router.put('/goals/:id/rework',                   ctrl.reworkGoal);
router.put('/goals/:id/edit',                     ctrl.managerEditGoal);
router.put('/goals/approve-all/:employee_id',     ctrl.approveAllGoals);
router.post('/checkin',                           ctrl.submitCheckin);
router.get('/checkin/:employee_id/:quarter',      ctrl.getCheckins);

router.post('/shared-goals',                      ctrl.pushSharedGoal);

// Aliases needed by frontend
router.get('/approval-queue',   ctrl.getTeam);          // frontend filters submitted goals
router.get('/team-progress',    ctrl.getTeam);          // frontend computes scores client-side

module.exports = router;
