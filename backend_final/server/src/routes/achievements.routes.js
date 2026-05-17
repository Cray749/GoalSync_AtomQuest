// server/src/routes/achievements.routes.js

'use strict';

const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const ctrl         = require('../controllers/achievements.controller');

router.use(authenticate);

// Summary — accessible by employee (own) + manager + admin
router.get('/summary/:employee_id', ctrl.getAchievementSummary);

// Per-goal achievements
router.get('/:goal_id',  ctrl.getAchievements);

// Submit / update actuals — employees only
router.post('/',         authorize('employee', 'manager'), ctrl.createAchievement);
router.put('/:id',       authorize('employee', 'manager'), ctrl.updateAchievement);

module.exports = router;
