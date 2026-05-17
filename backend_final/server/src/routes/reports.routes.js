// server/src/routes/reports.routes.js

'use strict';

const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const ctrl         = require('../controllers/reports.controller');

router.use(authenticate);
router.use(authorize('admin', 'manager'));

router.get('/achievement',       ctrl.achievementReport);
router.get('/completion-rate',   ctrl.completionRate);
router.get('/goal-distribution', ctrl.goalDistribution);
router.get('/team-scores',       ctrl.teamScores);

// Aliases for analytics page (Session 6)
router.get('/qoq-trend',              ctrl.goalDistribution);   // returns qoq_trend inside
router.get('/manager-effectiveness',  ctrl.completionRate);     // returns manager stats

module.exports = router;
