// server/src/controllers/achievements.controller.js

'use strict';

const { query } = require('../config/db');
const cycleService = require('../services/cycle.service');
const scoreService = require('../services/score.service');
const { writeNotification } = require('../services/audit.service');
const {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
} = require('../utils/response');

// ──────────────────────────────────────────────────────────────
// GET /api/achievements/:goal_id
// All quarterly achievements for a goal.
// ──────────────────────────────────────────────────────────────
async function getAchievements(req, res) {
  try {
    const { goal_id } = req.params;

    // Verify goal exists and employee owns it (or is manager/admin)
    const { rows: goalRows } = await query(
      'SELECT * FROM goals WHERE id = $1',
      [goal_id]
    );
    if (!goalRows[0]) return sendNotFound(res, 'Goal not found');

    const goal = goalRows[0];
    if (req.user.role === 'employee' && goal.employee_id !== req.user.id) {
      return sendForbidden(res, 'Access denied');
    }

    const { rows: achievements } = await query(
      'SELECT * FROM goal_achievements WHERE goal_id = $1 ORDER BY quarter',
      [goal_id]
    );

    // Enrich each achievement with its computed score
    const enriched = achievements.map(a => {
      const ratio = scoreService.calculateScore(
        goal.uom_type,
        goal.target_value,
        a.actual_value,
        goal.target_date,
        a.completion_date
      );
      return {
        ...a,
        score_ratio: ratio,
        score_display: scoreService.scoreToDisplay(ratio),
        score_pct: Math.min(ratio * 100, 150),
      };
    });

    return sendSuccess(res, enriched, 'Achievements fetched');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/achievements
// Submit a quarterly actual.
// Body: { goal_id, quarter, actual_value, goal_status, completion_date? }
// ──────────────────────────────────────────────────────────────
async function createAchievement(req, res) {
  try {
    const { goal_id, quarter, actual_value, goal_status, completion_date } = req.body;

    // ── Input validation ──────────────────────────────────────
    if (!goal_id) return sendBadRequest(res, 'goal_id is required');
    if (!quarter) return sendBadRequest(res, 'quarter is required');

    const validQuarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    if (!validQuarters.includes(quarter)) {
      return sendBadRequest(res, `quarter must be one of: ${validQuarters.join(', ')}`);
    }

    const validStatuses = ['not_started', 'on_track', 'completed', 'at_risk'];
    if (goal_status && !validStatuses.includes(goal_status)) {
      return sendBadRequest(res, `goal_status must be one of: ${validStatuses.join(', ')}`);
    }

    // ── Verify goal ownership ─────────────────────────────────
    const { rows: goalRows } = await query(
      'SELECT * FROM goals WHERE id = $1',
      [goal_id]
    );
    if (!goalRows[0]) return sendNotFound(res, 'Goal not found');

    const goal = goalRows[0];
    if (goal.employee_id !== req.user.id) {
      return sendForbidden(res, 'You can only log actuals for your own goals');
    }

    // ── Goal must be approved ─────────────────────────────────
    if (goal.status !== 'approved') {
      return sendBadRequest(res, 'Actuals can only be logged for approved goals');
    }

    // ── Window must be open for this quarter ──────────────────
    const { cycle, quarter: activeQuarter } = await cycleService.getActiveCycleWindow();
    if (!cycle) return sendBadRequest(res, 'No active goal cycle');
    if (activeQuarter !== quarter) {
      return sendBadRequest(
        res,
        activeQuarter
          ? `Check-in window for ${quarter} is not open. Current open quarter: ${activeQuarter}`
          : 'Check-in window is currently closed'
      );
    }

    // ── UoM-specific validation ───────────────────────────────
    if (['min', 'max'].includes(goal.uom_type)) {
      if (actual_value === null || actual_value === undefined || actual_value === '') {
        return sendBadRequest(res, 'actual_value is required for this goal type');
      }
      if (isNaN(Number(actual_value))) {
        return sendBadRequest(res, 'actual_value must be a number');
      }
    }

    if (goal.uom_type === 'timeline' && goal_status === 'completed' && !completion_date) {
      return sendBadRequest(res, 'completion_date is required when marking a timeline goal as completed');
    }

    // ── Compute score for the record ──────────────────────────
    const ratio = scoreService.calculateScore(
      goal.uom_type,
      goal.target_value,
      actual_value ?? null,
      goal.target_date,
      completion_date ?? null
    );

    // ── Upsert (one record per goal per quarter) ──────────────
    const { rows } = await query(`
      INSERT INTO goal_achievements
        (goal_id, quarter, planned_value, actual_value, completion_date, goal_status)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (goal_id, quarter) DO UPDATE SET
        actual_value    = EXCLUDED.actual_value,
        completion_date = EXCLUDED.completion_date,
        goal_status     = EXCLUDED.goal_status,
        submitted_at    = NOW(),
        updated_at      = NOW()
      RETURNING *
    `, [
      goal_id,
      quarter,
      goal.target_value ?? null,
      actual_value ?? null,
      completion_date ?? null,
      goal_status ?? 'not_started',
    ]);

    const achievement = rows[0];

    // ── Cascade actuals to shared-goal children (BRD §2.1) ──
    if (!goal.parent_goal_id) {
      const { rows: children } = await query(
        `SELECT id FROM goals WHERE parent_goal_id = $1 AND status = 'approved'`,
        [goal_id]
      );
      for (const child of children) {
        await query(`
          INSERT INTO goal_achievements
            (goal_id, quarter, planned_value, actual_value, completion_date, goal_status)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (goal_id, quarter) DO UPDATE SET
            actual_value    = EXCLUDED.actual_value,
            completion_date = EXCLUDED.completion_date,
            goal_status     = EXCLUDED.goal_status,
            submitted_at    = NOW(), updated_at = NOW()
        `, [child.id, quarter, goal.target_value ?? null,
        actual_value ?? null, completion_date ?? null, goal_status ?? 'not_started']);
      }
    }

    // ── Notify manager ────────────────────────────────────────
    const { rows: empRows } = await query(
      'SELECT manager_id, name FROM users WHERE id = $1',
      [req.user.id]
    );
    if (empRows[0]?.manager_id) {
      await writeNotification({
        userId: empRows[0].manager_id,
        title: `${quarter} actuals submitted`,
        message: `${empRows[0].name} has submitted ${quarter} actuals for "${goal.title}".`,
        link: `/manager/checkins`,
      });
    }

    return sendSuccess(res, {
      ...achievement,
      score_ratio: ratio,
      score_display: scoreService.scoreToDisplay(ratio),
      score_pct: Math.min(ratio * 100, 150),
    }, `${quarter} actuals saved`);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// PUT /api/achievements/:id
// Update an existing achievement (within the open window).
// ──────────────────────────────────────────────────────────────
async function updateAchievement(req, res) {
  try {
    const { rows: achRows } = await query(
      'SELECT ga.*, g.employee_id, g.uom_type, g.target_value, g.target_date FROM goal_achievements ga JOIN goals g ON g.id = ga.goal_id WHERE ga.id = $1',
      [req.params.id]
    );
    if (!achRows[0]) return sendNotFound(res, 'Achievement not found');

    const ach = achRows[0];
    if (ach.employee_id !== req.user.id) {
      return sendForbidden(res, 'Access denied');
    }

    // Window check
    const { quarter: activeQuarter } = await cycleService.getActiveCycleWindow();
    if (activeQuarter !== ach.quarter) {
      return sendBadRequest(res, `Check-in window for ${ach.quarter} is not open`);
    }

    const { actual_value, goal_status, completion_date } = req.body;

    const { rows } = await query(`
      UPDATE goal_achievements SET
        actual_value    = COALESCE($1, actual_value),
        goal_status     = COALESCE($2, goal_status),
        completion_date = COALESCE($3, completion_date),
        updated_at      = NOW()
      WHERE id = $4
      RETURNING *
    `, [actual_value ?? null, goal_status ?? null, completion_date ?? null, req.params.id]);

    const updated = rows[0];
    const ratio = scoreService.calculateScore(
      ach.uom_type,
      ach.target_value,
      updated.actual_value,
      ach.target_date,
      updated.completion_date
    );

    // ── Cascade actuals to shared-goal children (BRD §2.1) ───────
    // Only the primary owner (parent_goal_id IS NULL) triggers cascade.
    const { rows: parentGoalRows } = await query(
      'SELECT parent_goal_id FROM goals WHERE id = $1',
      [ach.goal_id]
    );
    if (parentGoalRows[0] && !parentGoalRows[0].parent_goal_id) {
      const { rows: children } = await query(
        `SELECT id FROM goals WHERE parent_goal_id = $1 AND status = 'approved'`,
        [ach.goal_id]
      );
      for (const child of children) {
        await query(`
          INSERT INTO goal_achievements
            (goal_id, quarter, planned_value, actual_value, completion_date, goal_status)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (goal_id, quarter) DO UPDATE SET
            actual_value    = EXCLUDED.actual_value,
            completion_date = EXCLUDED.completion_date,
            goal_status     = EXCLUDED.goal_status,
            submitted_at    = NOW(),
            updated_at      = NOW()
        `, [
          child.id, ach.quarter,
          ach.target_value ?? null,
          updated.actual_value ?? null,
          updated.completion_date ?? null,
          updated.goal_status ?? 'not_started',
        ]);
      }
    }

    return sendSuccess(res, {
      ...updated,
      score_ratio: ratio,
      score_display: scoreService.scoreToDisplay(ratio),
      score_pct: Math.min(ratio * 100, 150),
    }, 'Achievement updated');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/achievements/summary/:employee_id
// Full achievement summary with scores for all goals + quarters.
// Used by manager check-in view and reports.
// ──────────────────────────────────────────────────────────────
async function getAchievementSummary(req, res) {
  try {
    const employeeId = req.params.employee_id;

    // Role check: employees can only see their own summary
    if (req.user.role === 'employee' && req.user.id !== employeeId) {
      return sendForbidden(res, 'Access denied');
    }

    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;
    if (!cycleId) return sendSuccess(res, [], 'No active cycle');

    const { rows } = await query(`
      SELECT
        g.id, g.title, g.uom_type, g.target_value, g.target_date,
        g.weightage, g.status AS goal_status, g.is_locked,
        ta.name AS thrust_area_name,
        ga.quarter, ga.actual_value, ga.completion_date,
        ga.goal_status AS quarter_status, ga.submitted_at
      FROM goals g
      LEFT JOIN thrust_areas ta      ON ta.id = g.thrust_area_id
      LEFT JOIN goal_achievements ga ON ga.goal_id = g.id
      WHERE g.employee_id = $1 AND g.cycle_id = $2
      ORDER BY g.created_at, ga.quarter
    `, [employeeId, cycleId]);

    // Group by goal, with quarters as nested array
    const goalMap = {};
    for (const row of rows) {
      if (!goalMap[row.id]) {
        goalMap[row.id] = {
          id: row.id, title: row.title, uom_type: row.uom_type,
          target_value: row.target_value, target_date: row.target_date,
          weightage: row.weightage, goal_status: row.goal_status,
          is_locked: row.is_locked, thrust_area_name: row.thrust_area_name,
          quarters: [],
        };
      }
      if (row.quarter) {
        const ratio = scoreService.calculateScore(
          row.uom_type, row.target_value, row.actual_value,
          row.target_date, row.completion_date
        );
        goalMap[row.id].quarters.push({
          quarter: row.quarter,
          actual_value: row.actual_value,
          completion_date: row.completion_date,
          quarter_status: row.quarter_status,
          submitted_at: row.submitted_at,
          score_pct: Math.min(ratio * 100, 150),
          score_display: scoreService.scoreToDisplay(ratio),
        });
      }
    }

    return sendSuccess(res, Object.values(goalMap), 'Achievement summary fetched');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

module.exports = {
  getAchievements,
  createAchievement,
  updateAchievement,
  getAchievementSummary,
};
