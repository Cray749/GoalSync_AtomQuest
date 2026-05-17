// server/src/controllers/goals.controller.js

'use strict';

const goalService  = require('../services/goal.service');
const cycleService = require('../services/cycle.service');
const scoreService = require('../services/score.service');
const { query }    = require('../config/db');
const emailService = require('../services/email.service');
const notifService = require('../services/notification.service');
const {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
} = require('../utils/response');

// ──────────────────────────────────────────────────────────────
// GET /api/goals
// Returns the requesting employee's goals for a cycle.
// Optional ?cycle_id= query param; defaults to active cycle.
// ──────────────────────────────────────────────────────────────
async function getMyGoals(req, res) {
  try {
    let cycleId = req.query.cycle_id;

    if (!cycleId) {
      const cycle = await cycleService.getActiveCycle();
      if (!cycle) return sendSuccess(res, [], 'No active cycle');
      cycleId = cycle.id;
    }

    const goals = await goalService.getGoalsByEmployee(req.user.id, cycleId);

    // Enrich with latest achievement data for the active quarter
    const { window, quarter } = await cycleService.getActiveCycleWindow();

    let enriched = goals;
    if (quarter) {
      const goalIds = goals.map(g => g.id);
      if (goalIds.length > 0) {
        const placeholders = goalIds.map((_, i) => `$${i + 2}`).join(',');
        const { rows: achievements } = await query(
          `SELECT * FROM goal_achievements
           WHERE goal_id IN (${placeholders}) AND quarter = $1`,
          [quarter, ...goalIds]
        );
        enriched = scoreService.enrichGoalsWithScores(goals, achievements, quarter);
      }
    }

    // Compute overall weighted score
    const overallScore = scoreService.calculateOverallScore(
      enriched.map(g => ({
        ...g,
        actual_value:    g.actual_value    ?? null,
        completion_date: g.completion_date ?? null,
      }))
    );

    return sendSuccess(res, {
      goals: enriched,
      overall_score: scoreService.scoreToDisplay(overallScore),
      active_window: window,
      active_quarter: quarter,
      cycle_id: cycleId,
    }, 'Goals fetched');
  } catch (err) {
    return sendError(res, err.message, err.status || 500, err.message);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/goals/:id
// ──────────────────────────────────────────────────────────────
async function getGoalById(req, res) {
  try {
    // Managers and admins can view any goal; employees only their own
    const ownerCheck = req.user.role === 'employee' ? req.user.id : null;
    const goal = await goalService.getGoalById(req.params.id, ownerCheck);

    // Fetch all quarterly achievements for this goal
    const { rows: achievements } = await query(
      'SELECT * FROM goal_achievements WHERE goal_id = $1 ORDER BY quarter',
      [goal.id]
    );

    // Fetch check-in comments
    const { rows: checkins } = await query(`
      SELECT mc.*, u.name AS manager_name
      FROM manager_checkins mc
      JOIN users u ON u.id = mc.manager_id
      WHERE mc.goal_id = $1
      ORDER BY mc.quarter
    `, [goal.id]);

    return sendSuccess(res, { goal, achievements, checkins }, 'Goal fetched');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/goals
// ──────────────────────────────────────────────────────────────
async function createGoal(req, res) {
  try {
    // Goals can only be created in phase1 window
    const { window, cycle } = await cycleService.getActiveCycleWindow();

    if (!cycle) return sendBadRequest(res, 'No active goal cycle found');
    if (window !== 'phase1') {
      return sendBadRequest(res, 'Goal creation is only allowed during the Goal Setting window (Phase 1)');
    }

    const cycleId = req.body.cycle_id || cycle.id;
    const goal    = await goalService.createGoal(req.user.id, cycleId, req.body);

    return sendSuccess(res, goal, 'Goal created', 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// PUT /api/goals/:id
// ──────────────────────────────────────────────────────────────
async function updateGoal(req, res) {
  try {
    const goal = await goalService.updateGoal(req.params.id, req.user.id, req.body);
    return sendSuccess(res, goal, 'Goal updated');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// DELETE /api/goals/:id
// ──────────────────────────────────────────────────────────────
async function deleteGoal(req, res) {
  try {
    await goalService.deleteGoal(req.params.id, req.user.id);
    return sendSuccess(res, null, 'Goal deleted');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/goals/submit
// ──────────────────────────────────────────────────────────────
async function submitGoals(req, res) {
  try {
    const { window, cycle } = await cycleService.getActiveCycleWindow();

    if (!cycle) return sendBadRequest(res, 'No active goal cycle');
    if (window !== 'phase1') {
      return sendBadRequest(res, 'Goal submission is only allowed during the Goal Setting window (Phase 1)');
    }

    const cycleId = req.body.cycle_id || cycle.id;
    const result  = await goalService.submitGoals(req.user.id, cycleId, req.ip);

    // ─── SESSION 7: Fire-and-forget notifications ───────────────────────────
    setImmediate(async () => {
      try {
        const managerResult = await query(
          `SELECT m.id, m.name, m.email, gc.name AS cycle_name
           FROM users u
           JOIN users m ON m.id = u.manager_id
           JOIN goal_cycles gc ON gc.id = $2
           WHERE u.id = $1`,
          [req.user.id, cycleId]
        );
        if (!managerResult.rows.length) return;
        const mgr = managerResult.rows[0];
        const goalCount = await query(
          `SELECT COUNT(*) AS cnt FROM goals
           WHERE employee_id = $1 AND cycle_id = $2 AND status = 'submitted'`,
          [req.user.id, cycleId]
        );
        const count = parseInt(goalCount.rows[0].cnt, 10);

        await Promise.all([
          emailService.sendGoalsSubmittedEmail({
            managerEmail: mgr.email,
            managerName:  mgr.name,
            employeeName: req.user.name,
            goalCount:    count,
            cycleName:    mgr.cycle_name,
            employeeId:   req.user.id,
          }),
          notifService.notifyGoalsSubmitted({
            managerId:    mgr.id,
            employeeName: req.user.name,
            goalCount:    count,
            cycleName:    mgr.cycle_name,
            employeeId:   req.user.id,
          }),
        ]);
      } catch (notifErr) {
        console.error('[goals] Notification error on submit:', notifErr.message);
      }
    });
    // ─── END SESSION 7 ──────────────────────────────────────────────────────

    return sendSuccess(res, result, `${result.submitted} goal(s) submitted successfully`);
  } catch (err) {
    return sendError(res, err.message, err.status || 400);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/goals/thrust-areas
// Returns thrust areas for the active (or specified) cycle.
// ──────────────────────────────────────────────────────────────
async function getThrustAreas(req, res) {
  try {
    let cycleId = req.query.cycle_id;

    if (!cycleId) {
      const cycle = await cycleService.getActiveCycle();
      if (!cycle) return sendSuccess(res, [], 'No active cycle');
      cycleId = cycle.id;
    }

    const areas = await goalService.getThrustAreasByCycle(cycleId);
    return sendSuccess(res, areas, 'Thrust areas fetched');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/goals/cycle
// Returns the active cycle info + window.
// ──────────────────────────────────────────────────────────────
async function getActiveCycle(req, res) {
  try {
    const { cycle, window, quarter } = await cycleService.getActiveCycleWindow();
    if (!cycle) return sendSuccess(res, null, 'No active cycle');
    return sendSuccess(res, {
      ...cycle,
      active_window:        window,
      active_quarter:       quarter,
      is_goal_setting_open: window === 'phase1',
      is_checkin_open:      ['q1','q2','q3','q4'].includes(window),
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

module.exports = {
  getMyGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  submitGoals,
  getThrustAreas,
  getActiveCycle,
};
