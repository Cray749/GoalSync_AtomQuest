// server/src/controllers/manager.controller.js

'use strict';

const { query, withTransaction } = require('../config/db');
const cycleService  = require('../services/cycle.service');
const scoreService  = require('../services/score.service');
const { writeAuditLog, writeNotification } = require('../services/audit.service');
const emailService  = require('../services/email.service');
const notifService  = require('../services/notification.service');
const {
  sendSuccess, sendError, sendBadRequest, sendNotFound, sendForbidden,
} = require('../utils/response');

// ──────────────────────────────────────────────────────────────
// GET /api/manager/team
// All employees whose manager_id = req.user.id, with goal status.
// ──────────────────────────────────────────────────────────────
async function getTeam(req, res) {
  try {
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;

    const { rows } = await query(`
      SELECT
        u.id, u.name, u.email, u.department,
        COUNT(g.id)                                          AS total_goals,
        COUNT(g.id) FILTER (WHERE g.status = 'submitted')   AS submitted_goals,
        COUNT(g.id) FILTER (WHERE g.status = 'approved')    AS approved_goals,
        COUNT(g.id) FILTER (WHERE g.status = 'draft')       AS draft_goals,
        COUNT(g.id) FILTER (WHERE g.status = 'rework')      AS rework_goals,
        MAX(g.updated_at)                                    AS last_goal_update
      FROM users u
      LEFT JOIN goals g ON g.employee_id = u.id AND g.cycle_id = $2
      WHERE u.manager_id = $1
        AND u.is_active  = TRUE
      GROUP BY u.id, u.name, u.email, u.department
      ORDER BY u.name
    `, [req.user.id, cycleId]);

    // For each team member, get last check-in quarter
    for (const member of rows) {
      const { rows: ciRows } = await query(`
        SELECT mc.quarter, MAX(mc.created_at) AS last_checkin
        FROM manager_checkins mc
        JOIN goals g ON g.id = mc.goal_id
        WHERE mc.manager_id = $1
          AND g.employee_id = $2
          AND ($3::uuid IS NULL OR g.cycle_id = $3)
        GROUP BY mc.quarter
        ORDER BY mc.quarter DESC
        LIMIT 1
      `, [req.user.id, member.id, cycleId || null]);
      member.last_checkin_quarter = ciRows[0]?.quarter || null;
      member.last_checkin_at      = ciRows[0]?.last_checkin || null;
    }

    return sendSuccess(res, rows, 'Team fetched');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/manager/team-progress
// Team progress including quarterly scores and overall score.
// ──────────────────────────────────────────────────────────────
async function getTeamProgress(req, res) {
  try {
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;
    if (!cycleId) return sendSuccess(res, [], 'No active cycle');

    // Get team members
    const { rows: team } = await query(
      'SELECT id, name FROM users WHERE manager_id = $1 AND is_active = TRUE',
      [req.user.id]
    );

    const result = [];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

    for (const member of team) {
      const { rows: goals } = await query(`
        SELECT g.*
        FROM goals g
        WHERE g.employee_id = $1 AND g.cycle_id = $2 AND g.status = 'approved'
      `, [member.id, cycleId]);

      let achievements = [];
      if (goals.length > 0) {
        const ids = goals.map(g => g.id);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        const { rows: achRows } = await query(`
          SELECT * FROM goal_achievements WHERE goal_id IN (${placeholders})
        `, ids);
        achievements = achRows;
      }

      const quarterly_scores = { Q1: null, Q2: null, Q3: null, Q4: null };
      let latestScore = 0;
      let hasData = false;

      for (const q of quarters) {
        const enriched = scoreService.enrichGoalsWithScores(goals, achievements, q);
        const hasActuals = enriched.some(g => g.actual_value !== null && g.actual_value !== undefined);
        if (hasActuals) {
          const score = scoreService.calculateOverallScore(enriched);
          quarterly_scores[q] = scoreService.scoreToDisplay(score);
          latestScore = quarterly_scores[q];
          hasData = true;
        }
      }

      result.push({
        employee_id: member.id,
        employee_name: member.name,
        overall_score_pct: hasData ? latestScore : 0,
        quarterly_scores
      });
    }

    return sendSuccess(res, result, 'Team progress fetched');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/manager/team/:employee_id/goals
// Full goal sheet for a specific team member.
// ──────────────────────────────────────────────────────────────
async function getEmployeeGoals(req, res) {
  try {
    const { employee_id } = req.params;

    // Verify this employee actually reports to this manager
    const { rows: empRows } = await query(
      'SELECT * FROM users WHERE id = $1 AND manager_id = $2 AND is_active = TRUE',
      [employee_id, req.user.id]
    );
    if (!empRows[0]) {
      return sendForbidden(res, 'This employee does not report to you');
    }

    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;

    const { rows: goals } = await query(`
      SELECT g.*,
             ta.name AS thrust_area_name
      FROM goals g
      LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
      WHERE g.employee_id = $1 AND g.cycle_id = $2
      ORDER BY g.created_at
    `, [employee_id, cycleId]);

    // Enrich with latest actuals
    const { quarter } = await cycleService.getActiveCycleWindow();
    let enriched = goals;
    if (quarter && goals.length > 0) {
      const ids = goals.map(g => g.id);
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      const { rows: achievements } = await query(
        `SELECT * FROM goal_achievements WHERE goal_id IN (${placeholders}) AND quarter = $1`,
        [quarter, ...ids]
      );
      enriched = scoreService.enrichGoalsWithScores(goals, achievements, quarter);
    }

    const overallScore = scoreService.calculateOverallScore(enriched);

    return sendSuccess(res, {
      employee:      empRows[0],
      goals:         enriched,
      overall_score: scoreService.scoreToDisplay(overallScore),
      cycle_id:      cycleId,
    }, 'Employee goals fetched');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// PUT /api/manager/goals/:id/approve
// Approve a goal → status='approved', is_locked=TRUE
// ──────────────────────────────────────────────────────────────
async function approveGoal(req, res) {
  try {
    const goal = await _getTeamGoal(req.params.id, req.user.id);

    if (goal.status !== 'submitted') {
      return sendBadRequest(res, `Cannot approve a goal with status '${goal.status}'. Only submitted goals can be approved.`);
    }

    await withTransaction(async (client) => {
      await client.query(`
        UPDATE goals
        SET status = 'approved', is_locked = TRUE, updated_at = NOW()
        WHERE id = $1
      `, [goal.id]);

      await writeAuditLog({
        goalId:    goal.id,
        userId:    req.user.id,
        action:    'goal_approved',
        fieldName: 'status',
        oldValue:  'submitted',
        newValue:  'approved',
        ipAddress: req.ip,
        client,
      });

      await writeNotification({
        userId:  goal.employee_id,
        title:   'Goal approved ✅',
        message: `Your goal "${goal.title}" has been approved by your manager.`,
        link:    '/employee/goals',
        client,
      });
    });

    // Check if ALL goals for this employee+cycle are now approved → send final email trigger
    const { rows: remaining } = await query(`
      SELECT COUNT(*) AS cnt FROM goals
      WHERE employee_id = $1 AND cycle_id = $2
        AND status NOT IN ('approved')
    `, [goal.employee_id, goal.cycle_id]);

    const allApproved = Number(remaining[0].cnt) === 0;

    // ─── SESSION 7: Fire-and-forget notifications ───────────────────────────
    setImmediate(async () => {
      try {
        const infoResult = await query(
          `SELECT u.id, u.name, u.email, gc.name AS cycle_name,
                  COUNT(g2.id) AS approved_count
           FROM goals g
           JOIN users u ON u.id = g.employee_id
           JOIN goal_cycles gc ON gc.id = g.cycle_id
           JOIN goals g2 ON g2.employee_id = u.id AND g2.cycle_id = g.cycle_id
                         AND g2.status = 'approved'
           WHERE g.id = $1
           GROUP BY u.id, u.name, u.email, gc.name`,
          [goal.id]
        );
        if (!infoResult.rows.length) return;
        const info = infoResult.rows[0];

        await Promise.all([
          emailService.sendGoalsApprovedEmail({
            employeeEmail: info.email,
            employeeName:  info.name,
            managerName:   req.user.name,
            cycleName:     info.cycle_name,
            approvedCount: parseInt(info.approved_count, 10),
          }),
          notifService.notifyGoalsApproved({
            employeeId:    info.id,
            managerName:   req.user.name,
            approvedCount: parseInt(info.approved_count, 10),
            cycleName:     info.cycle_name,
          }),
        ]);
      } catch (notifErr) {
        console.error('[manager] Notification error on approve:', notifErr.message);
      }
    });
    // ─── END SESSION 7 ──────────────────────────────────────────────────────

    return sendSuccess(res, { approved: true, all_goals_approved: allApproved },
      allApproved
        ? 'Goal approved. All goals for this employee are now finalized.'
        : 'Goal approved');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// PUT /api/manager/goals/:id/rework
// Return for rework with mandatory comment.
// ──────────────────────────────────────────────────────────────
async function reworkGoal(req, res) {
  try {
    const { comment } = req.body;
    if (!comment || comment.trim().length < 5) {
      return sendBadRequest(res, 'A rework comment of at least 5 characters is required');
    }

    const goal = await _getTeamGoal(req.params.id, req.user.id);

    if (goal.status !== 'submitted') {
      return sendBadRequest(res, `Only submitted goals can be returned for rework`);
    }

    await withTransaction(async (client) => {
      await client.query(`
        UPDATE goals
        SET status = 'rework', rework_comment = $1, is_locked = FALSE, updated_at = NOW()
        WHERE id = $2
      `, [comment.trim(), goal.id]);

      await writeAuditLog({
        goalId: goal.id, userId: req.user.id,
        action: 'goal_returned_rework',
        fieldName: 'status', oldValue: 'submitted', newValue: 'rework',
        ipAddress: req.ip, client,
      });

      await writeNotification({
        userId:  goal.employee_id,
        title:   'Goal returned for revision 🔄',
        message: `Your manager returned "${goal.title}" for revision: ${comment.trim()}`,
        link:    '/employee/goals',
        client,
      });
    });

    // ─── SESSION 7: Fire-and-forget notifications ───────────────────────────
    setImmediate(async () => {
      try {
        const infoResult = await query(
          `SELECT u.id, u.name, u.email, g.title
           FROM goals g JOIN users u ON u.id = g.employee_id
           WHERE g.id = $1`,
          [goal.id]
        );
        if (!infoResult.rows.length) return;
        const info = infoResult.rows[0];

        await Promise.all([
          emailService.sendGoalsReworkEmail({
            employeeEmail: info.email,
            employeeName:  info.name,
            managerName:   req.user.name,
            goalTitle:     info.title,
            reworkComment: comment,
          }),
          notifService.notifyGoalsRework({
            employeeId:  info.id,
            managerName: req.user.name,
            goalTitle:   info.title,
          }),
        ]);
      } catch (notifErr) {
        console.error('[manager] Notification error on rework:', notifErr.message);
      }
    });
    // ─── END SESSION 7 ──────────────────────────────────────────────────────

    return sendSuccess(res, null, 'Goal returned for rework');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// PUT /api/manager/goals/:id/edit
// Inline edit target/weightage before approving.
// ──────────────────────────────────────────────────────────────
async function managerEditGoal(req, res) {
  try {
    const goal = await _getTeamGoal(req.params.id, req.user.id);

    if (!['submitted', 'rework'].includes(goal.status)) {
      return sendBadRequest(res, 'Only submitted or rework goals can be edited by manager');
    }
    if (goal.is_locked) {
      return sendForbidden(res, 'Goal is locked');
    }

    const { target_value, weightage, description } = req.body;

    const updates  = [];
    const params   = [];
    let   paramIdx = 1;

    if (target_value !== undefined) {
      if (Number(target_value) <= 0) return sendBadRequest(res, 'Target must be positive');
      updates.push(`target_value = $${paramIdx++}`);
      params.push(target_value);
    }
    if (weightage !== undefined) {
      if (Number(weightage) < 10) return sendBadRequest(res, 'Minimum weightage is 10%');
      updates.push(`weightage = $${paramIdx++}`);
      params.push(weightage);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      params.push(description);
    }

    if (updates.length === 0) return sendBadRequest(res, 'No fields to update');

    updates.push(`updated_at = NOW()`);
    params.push(goal.id);

    const { rows } = await query(
      `UPDATE goals SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );

    await writeAuditLog({
      goalId: goal.id, userId: req.user.id,
      action: 'manager_edited_goal',
      newValue: JSON.stringify(req.body),
      ipAddress: req.ip,
    });

    return sendSuccess(res, rows[0], 'Goal updated by manager');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// PUT /api/manager/goals/approve-all/:employee_id
// Bulk approve all submitted goals for one employee.
// ──────────────────────────────────────────────────────────────
async function approveAllGoals(req, res) {
  try {
    const { employee_id } = req.params;
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;

    // Verify employee reports to this manager
    const { rows: empRows } = await query(
      'SELECT id, name FROM users WHERE id = $1 AND manager_id = $2',
      [employee_id, req.user.id]
    );
    if (!empRows[0]) return sendForbidden(res, 'Employee does not report to you');

    const { rows: goals } = await query(`
      SELECT id, title FROM goals
      WHERE employee_id = $1 AND cycle_id = $2 AND status = 'submitted'
    `, [employee_id, cycleId]);

    if (goals.length === 0) return sendBadRequest(res, 'No submitted goals to approve');

    await withTransaction(async (client) => {
      for (const g of goals) {
        await client.query(`
          UPDATE goals SET status = 'approved', is_locked = TRUE, updated_at = NOW()
          WHERE id = $1
        `, [g.id]);

        await writeAuditLog({
          goalId: g.id, userId: req.user.id,
          action: 'goal_approved', fieldName: 'status',
          oldValue: 'submitted', newValue: 'approved',
          ipAddress: req.ip, client,
        });
      }

      await writeNotification({
        userId:  employee_id,
        title:   'All goals approved ✅',
        message: `All your goals have been approved and finalized by your manager.`,
        link:    '/employee/goals',
        client,
      });
    });

    return sendSuccess(res, { approved: goals.length },
      `${goals.length} goal(s) approved`);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/manager/checkin
// Submit a check-in comment for a goal + quarter.
// ──────────────────────────────────────────────────────────────
async function submitCheckin(req, res) {
  try {
    const { goal_id, quarter, comment } = req.body;

    if (!goal_id)  return sendBadRequest(res, 'goal_id is required');
    if (!quarter)  return sendBadRequest(res, 'quarter is required');
    if (!comment || comment.trim().length < 3) {
      return sendBadRequest(res, 'A meaningful comment (min 3 chars) is required');
    }

    const validQ = ['Q1', 'Q2', 'Q3', 'Q4'];
    if (!validQ.includes(quarter)) return sendBadRequest(res, 'Invalid quarter');

    // Verify goal belongs to a team member
    await _getTeamGoal(goal_id, req.user.id);

    const { rows } = await query(`
      INSERT INTO manager_checkins (goal_id, manager_id, quarter, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (goal_id, manager_id, quarter) DO UPDATE
        SET comment = EXCLUDED.comment, created_at = NOW()
      RETURNING *
    `, [goal_id, req.user.id, quarter, comment.trim()]);

    return sendSuccess(res, rows[0], 'Check-in saved');
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/manager/checkin/:employee_id/:quarter
// All check-in comments for a team member in a quarter.
// ──────────────────────────────────────────────────────────────
async function getCheckins(req, res) {
  try {
    const { employee_id, quarter } = req.params;

    const { rows } = await query(`
      SELECT mc.*, g.title AS goal_title, g.uom_type, g.target_value,
             ga.actual_value, ga.goal_status AS quarter_status
      FROM manager_checkins mc
      JOIN goals g ON g.id = mc.goal_id
      LEFT JOIN goal_achievements ga ON ga.goal_id = g.id AND ga.quarter = mc.quarter
      WHERE mc.manager_id = $1
        AND g.employee_id = $2
        AND mc.quarter    = $3
      ORDER BY g.created_at
    `, [req.user.id, employee_id, quarter]);

    return sendSuccess(res, rows, 'Check-ins fetched');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// Helper — get a goal that belongs to a manager's team member
// ──────────────────────────────────────────────────────────────
async function _getTeamGoal(goalId, managerId) {
  const { rows } = await query(`
    SELECT g.* FROM goals g
    JOIN users u ON u.id = g.employee_id
    WHERE g.id = $1 AND u.manager_id = $2
  `, [goalId, managerId]);

  if (!rows[0]) {
    const err = new Error('Goal not found or does not belong to your team');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

// ──────────────────────────────────────────────────────────────
// POST /api/manager/shared-goals
// Manager pushes a shared goal to their team members
// ──────────────────────────────────────────────────────────────
async function pushSharedGoal(req, res) {
  try {
    const { goal_template, employee_ids } = req.body;

    if (!goal_template || !employee_ids?.length) {
      return sendBadRequest(res, 'goal_template and employee_ids are required');
    }

    const {
      title, description, uom_type, target_value,
      target_date, thrust_area_id, cycle_id,
    } = goal_template;

    if (!title || !uom_type || !cycle_id) {
      return sendBadRequest(res, 'goal_template requires title, uom_type, cycle_id');
    }

    return withTransaction(async (client) => {
      // Create template (parent) goal under manager
      const { rows: templateRows } = await client.query(`
        INSERT INTO goals
          (employee_id, cycle_id, thrust_area_id, title, description,
           uom_type, target_value, target_date, weightage,
           status, is_shared, is_locked)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,'approved',TRUE,TRUE)
        RETURNING *
      `, [req.user.id, cycle_id, thrust_area_id || null, title, description || null,
          uom_type, target_value || null, target_date || null]);

      const template = templateRows[0];
      const created  = [];

      for (const empId of employee_ids) {
        // Verify user exists, is active, AND reports to this manager
        const { rows: empRows } = await client.query(
          'SELECT id FROM users WHERE id = $1 AND is_active = TRUE AND manager_id = $2', 
          [empId, req.user.id]
        );
        if (!empRows[0]) continue;

        const { rows: childRows } = await client.query(`
          INSERT INTO goals
            (employee_id, cycle_id, thrust_area_id, title, description,
             uom_type, target_value, target_date, weightage,
             status, is_shared, is_locked, parent_goal_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,'approved',TRUE,FALSE,$9)
          RETURNING *
        `, [empId, cycle_id, thrust_area_id || null, title, description || null,
            uom_type, target_value || null, target_date || null, template.id]);

        created.push(childRows[0]);

        await writeNotification({
          userId:  empId,
          title:   'Shared goal assigned',
          message: `A shared goal "${title}" has been assigned to you by your manager.`,
          link:    '/employee/goals',
          client,
        });
      }

      await writeAuditLog({
        goalId: template.id, userId: req.user.id,
        action: 'shared_goal_pushed',
        newValue: `Pushed to ${created.length} team members`,
        ipAddress: req.ip, client,
      });

      return sendSuccess(res, { template, children: created },
        `Shared goal pushed to ${created.length} team member(s)`, 201);
    });
  } catch (err) { return sendError(res, err.message, 500); }
}

module.exports = {
  getTeam,
  getEmployeeGoals,
  approveGoal,
  reworkGoal,
  managerEditGoal,
  approveAllGoals,
  submitCheckin,
  getCheckins,
  pushSharedGoal,
  getTeamProgress,
};
