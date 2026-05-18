// server/src/controllers/admin.controller.js

'use strict';

const bcrypt       = require('bcrypt');
const { query, withTransaction } = require('../config/db');
const cycleService = require('../services/cycle.service');
const { writeAuditLog, writeNotification } = require('../services/audit.service');
const {
  sendSuccess, sendError, sendBadRequest, sendNotFound, sendForbidden,
} = require('../utils/response');

const SALT_ROUNDS = 10;

// ══════════════════════════════════════════════════════════════
// CYCLE MANAGEMENT
// ══════════════════════════════════════════════════════════════

async function getCycles(req, res) {
  try {
    const { rows } = await query(
      'SELECT * FROM goal_cycles ORDER BY year DESC, created_at DESC'
    );
    return sendSuccess(res, rows, 'Cycles fetched');
  } catch (err) { return sendError(res, err.message, 500); }
}

async function createCycle(req, res) {
  try {
    const {
      name, year,
      phase1_start, phase1_end,
      q1_start, q1_end,
      q2_start, q2_end,
      q3_start, q3_end,
      q4_start, q4_end,
      is_active = false,
    } = req.body;

    const required = { name, year, phase1_start, phase1_end, q1_start, q1_end,
                       q2_start, q2_end, q3_start, q3_end, q4_start, q4_end };
    for (const [k, v] of Object.entries(required)) {
      if (!v) return sendBadRequest(res, `${k} is required`);
    }

    return withTransaction(async (client) => {
      // Only one active cycle at a time
      if (is_active) {
        await client.query('UPDATE goal_cycles SET is_active = FALSE');
      }

      const { rows } = await client.query(`
        INSERT INTO goal_cycles
          (name, year, phase1_start, phase1_end,
           q1_start, q1_end, q2_start, q2_end,
           q3_start, q3_end, q4_start, q4_end,
           is_active, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
      `, [name, year, phase1_start, phase1_end,
          q1_start, q1_end, q2_start, q2_end,
          q3_start, q3_end, q4_start, q4_end,
          is_active, req.user.id]);

      return sendSuccess(res, rows[0], 'Cycle created', 201);
    });
  } catch (err) { return sendError(res, err.message, 500); }
}

async function updateCycle(req, res) {
  try {
    const { id } = req.params;
    const { rows: existing } = await query('SELECT * FROM goal_cycles WHERE id = $1', [id]);
    if (!existing[0]) return sendNotFound(res, 'Cycle not found');

    const fields = [
      'name','year','phase1_start','phase1_end',
      'q1_start','q1_end','q2_start','q2_end',
      'q3_start','q3_end','q4_start','q4_end','is_active',
    ];

    return withTransaction(async (client) => {
      const updates = []; const params = [];
      let idx = 1;

      for (const f of fields) {
        if (req.body[f] !== undefined) {
          if (f === 'is_active' && req.body[f]) {
            await client.query('UPDATE goal_cycles SET is_active = FALSE WHERE id != $1', [id]);
          }
          updates.push(`${f} = $${idx++}`);
          params.push(req.body[f]);
        }
      }

      if (updates.length === 0) return sendBadRequest(res, 'No fields to update');
      params.push(id);

      const { rows } = await client.query(
        `UPDATE goal_cycles SET ${updates.join(',')} WHERE id = $${idx} RETURNING *`,
        params
      );
      return sendSuccess(res, rows[0], 'Cycle updated');
    });
  } catch (err) { return sendError(res, err.message, 500); }
}

// ══════════════════════════════════════════════════════════════
// THRUST AREAS
// ══════════════════════════════════════════════════════════════

async function getThrustAreas(req, res) {
  try {
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;
    if (!cycleId) return sendSuccess(res, [], 'No active cycle');
    const { rows } = await query(
      'SELECT * FROM thrust_areas WHERE cycle_id = $1 ORDER BY name',
      [cycleId]
    );
    return sendSuccess(res, rows, 'Thrust areas fetched');
  } catch (err) { return sendError(res, err.message, 500); }
}

async function createThrustArea(req, res) {
  try {
    const { name, description, cycle_id } = req.body;
    if (!name || !cycle_id) return sendBadRequest(res, 'name and cycle_id are required');

    const { rows } = await query(`
      INSERT INTO thrust_areas (name, description, cycle_id, created_by)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [name.trim(), description || null, cycle_id, req.user.id]);

    return sendSuccess(res, rows[0], 'Thrust area created', 201);
  } catch (err) { return sendError(res, err.message, 500); }
}

async function updateThrustArea(req, res) {
  try {
    const { rows } = await query(`
      UPDATE thrust_areas SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description),
        is_active   = COALESCE($3, is_active)
      WHERE id = $4 RETURNING *
    `, [req.body.name, req.body.description, req.body.is_active, req.params.id]);

    if (!rows[0]) return sendNotFound(res, 'Thrust area not found');
    return sendSuccess(res, rows[0], 'Thrust area updated');
  } catch (err) { return sendError(res, err.message, 500); }
}

// ══════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ══════════════════════════════════════════════════════════════

async function getUsers(req, res) {
  try {
    const { rows } = await query(`
      SELECT u.id, u.name, u.email, u.role, u.department,
             u.manager_id, u.is_active, u.created_at,
             m.name AS manager_name
      FROM users u
      LEFT JOIN users m ON m.id = u.manager_id
      ORDER BY u.role, u.name
    `);
    return sendSuccess(res, rows, 'Users fetched');
  } catch (err) { return sendError(res, err.message, 500); }
}

async function createUser(req, res) {
  try {
    const { name, email, password, role, department, manager_id } = req.body;

    if (!name || !email || !password || !role) {
      return sendBadRequest(res, 'name, email, password, and role are required');
    }
    const validRoles = ['employee', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return sendBadRequest(res, `role must be one of: ${validRoles.join(', ')}`);
    }

    const { rows: existing } = await query(
      'SELECT id FROM users WHERE email = $1', [email.toLowerCase()]
    );
    if (existing[0]) return sendBadRequest(res, 'Email already in use');

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows } = await query(`
      INSERT INTO users (name, email, password_hash, role, department, manager_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, department, manager_id, created_at
    `, [name.trim(), email.toLowerCase(), hash, role, department || null, manager_id || null]);

    return sendSuccess(res, rows[0], 'User created', 201);
  } catch (err) { return sendError(res, err.message, 500); }
}

async function updateUser(req, res) {
  try {
    const { name, role, department, manager_id, is_active, password } = req.body;
    const updates = []; const params = []; let idx = 1;

    if (name)                       { updates.push(`name = $${idx++}`);       params.push(name); }
    if (role)                       { updates.push(`role = $${idx++}`);       params.push(role); }
    if (department !== undefined)   { updates.push(`department = $${idx++}`); params.push(department); }
    if (manager_id  !== undefined)  { updates.push(`manager_id = $${idx++}`); params.push(manager_id || null); }
    if (is_active   !== undefined)  { updates.push(`is_active = $${idx++}`);  params.push(is_active); }
    if (password) {
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push(`password_hash = $${idx++}`);
      params.push(hash);
    }

    if (updates.length === 0) return sendBadRequest(res, 'No fields to update');
    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const { rows } = await query(
      `UPDATE users SET ${updates.join(',')} WHERE id = $${idx} RETURNING id, name, email, role, department, manager_id, is_active`,
      params
    );
    if (!rows[0]) return sendNotFound(res, 'User not found');
    return sendSuccess(res, rows[0], 'User updated');
  } catch (err) { return sendError(res, err.message, 500); }
}

// ══════════════════════════════════════════════════════════════
// SHARED GOALS — Push a KPI to multiple employees
// ══════════════════════════════════════════════════════════════

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
      // Create template (parent) goal under admin
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
        // Verify user exists and is active
        const { rows: empRows } = await client.query(
          'SELECT id FROM users WHERE id = $1 AND is_active = TRUE', [empId]
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
          message: `A company KPI goal "${title}" has been assigned to you.`,
          link:    '/employee/goals',
          client,
        });
      }

      await writeAuditLog({
        goalId: template.id, userId: req.user.id,
        action: 'shared_goal_pushed',
        newValue: `Pushed to ${created.length} employees`,
        ipAddress: req.ip, client,
      });

      return sendSuccess(res, { template, children: created },
        `Shared goal pushed to ${created.length} employee(s)`, 201);
    });
  } catch (err) { return sendError(res, err.message, 500); }
}

// ══════════════════════════════════════════════════════════════
// UNLOCK GOAL — Admin exception handling
// ══════════════════════════════════════════════════════════════

async function unlockGoal(req, res) {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length < 10) {
      return sendBadRequest(res, 'A reason of at least 10 characters is required to unlock a goal');
    }

    const { rows: goalRows } = await query('SELECT * FROM goals WHERE id = $1', [req.params.id]);
    if (!goalRows[0]) return sendNotFound(res, 'Goal not found');

    const goal = goalRows[0];
    if (!goal.is_locked) {
      return sendBadRequest(res, 'Goal is already unlocked');
    }

    await withTransaction(async (client) => {
      await client.query(
        'UPDATE goals SET is_locked = FALSE, updated_at = NOW() WHERE id = $1',
        [goal.id]
      );

      await writeAuditLog({
        goalId: goal.id, userId: req.user.id,
        action: 'goal_unlocked',
        fieldName: 'is_locked', oldValue: 'true', newValue: 'false',
        ipAddress: req.ip, client,
      });

      // Write the reason as a second audit entry
      await writeAuditLog({
        goalId: goal.id, userId: req.user.id,
        action: 'unlock_reason',
        newValue: reason.trim(),
        ipAddress: req.ip, client,
      });

      await writeNotification({
        userId:  goal.employee_id,
        title:   'Goal unlocked for editing',
        message: `Admin has unlocked your goal "${goal.title}" for editing. Reason: ${reason.trim()}`,
        link:    '/employee/goals',
        client,
      });
    });

    return sendSuccess(res, null, 'Goal unlocked successfully');
  } catch (err) { return sendError(res, err.message, 500); }
}

// ══════════════════════════════════════════════════════════════
// COMPLETION DASHBOARD
// ══════════════════════════════════════════════════════════════

async function getCompletionDashboard(req, res) {
  try {
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;
    if (!cycleId) return sendSuccess(res, {}, 'No active cycle');

    // Goal submission status per employee
    const { rows: submissionRows } = await query(`
      SELECT
        u.id, u.name, u.email, u.department,
        m.name AS manager_name,
        COUNT(g.id)                                        AS total_goals,
        COUNT(g.id) FILTER (WHERE g.status = 'draft')      AS draft,
        COUNT(g.id) FILTER (WHERE g.status = 'submitted')  AS submitted,
        COUNT(g.id) FILTER (WHERE g.status = 'approved')   AS approved,
        COUNT(g.id) FILTER (WHERE g.status = 'rework')     AS rework
      FROM users u
      LEFT JOIN users m  ON m.id = u.manager_id
      LEFT JOIN goals g  ON g.employee_id = u.id AND g.cycle_id = $1
      WHERE u.role IN ('employee','manager') AND u.is_active = TRUE
      GROUP BY u.id, u.name, u.email, u.department, m.name
      ORDER BY u.department, u.name
    `, [cycleId]);

    // Check-in completion per employee per quarter
    const { rows: checkinRows } = await query(`
      SELECT
        g.employee_id,
        ga.quarter,
        COUNT(DISTINCT g.id)  AS total_goals,
        COUNT(DISTINCT mc.goal_id) AS checked_in
      FROM goals g
      LEFT JOIN goal_achievements ga ON ga.goal_id = g.id
      LEFT JOIN manager_checkins mc  ON mc.goal_id = g.id AND mc.quarter = ga.quarter
      WHERE g.cycle_id = $1 AND g.status = 'approved'
      GROUP BY g.employee_id, ga.quarter
    `, [cycleId]);

    // Org-wide metrics
    const total      = submissionRows.length;
    const submitted  = submissionRows.filter(r => Number(r.submitted) > 0 || Number(r.approved) > 0).length;
    const allApproved= submissionRows.filter(r => Number(r.approved) > 0 && Number(r.draft) === 0 && Number(r.submitted) === 0).length;

    return sendSuccess(res, {
      summary: {
        total_employees: total,
        goals_submitted: submitted,
        goals_all_approved: allApproved,
        submission_rate: total > 0 ? Math.round((submitted / total) * 100) : 0,
      },
      employees: submissionRows,
      checkin_matrix: checkinRows,
    }, 'Completion dashboard fetched');
  } catch (err) { return sendError(res, err.message, 500); }
}

// ══════════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════════

async function getAuditLogs(req, res) {
  try {
    const {
      goal_id, user_id, action,
      page = 1, limit = 50,
    } = req.query;

    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (goal_id) { conditions.push(`al.goal_id = $${idx++}`);  params.push(goal_id); }
    if (user_id) { conditions.push(`al.user_id = $${idx++}`);  params.push(user_id); }
    if (action)  { conditions.push(`al.action ILIKE $${idx++}`); params.push(`%${action}%`); }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const { rows } = await query(`
      SELECT al.*, u.name AS actor_name, u.email AS actor_email, u.role AS actor_role,
             g.title AS goal_title
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN goals g ON g.id = al.goal_id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, limit, offset]);

    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS total FROM audit_logs al ${where}`, params
    );

    return sendSuccess(res, {
      logs:  rows,
      total: Number(countRows[0].total),
      page:  Number(page),
      limit: Number(limit),
    }, 'Audit logs fetched');
  } catch (err) { return sendError(res, err.message, 500); }
}

// ══════════════════════════════════════════════════════════════
// ORG STATS — used by Admin Overview top stat cards
// GET /api/admin/stats
// ══════════════════════════════════════════════════════════════

async function getOrgStats(req, res) {
  try {
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;

    // User counts
    const { rows: userRows } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'employee' AND is_active = TRUE) AS employees,
        COUNT(*) FILTER (WHERE role = 'manager'  AND is_active = TRUE) AS managers,
        COUNT(*) FILTER (WHERE role = 'admin'    AND is_active = TRUE) AS admins,
        COUNT(*) FILTER (WHERE is_active = TRUE)                       AS total
      FROM users
    `);

    const users = userRows[0];

    if (!cycleId) {
      return sendSuccess(res, {
        cycle: null,
        users: {
          employees: Number(users.employees),
          managers:  Number(users.managers),
          admins:    Number(users.admins),
          total:     Number(users.total),
        },
        goals: {
          total: 0, draft: 0, submitted: 0, approved: 0, rework: 0,
          approval_rate_pct: 0, submission_rate_pct: 0,
        },
      }, 'Org stats — no active cycle');
    }

    // Active cycle
    const { rows: cycleRows } = await query(
      'SELECT * FROM goal_cycles WHERE id = $1', [cycleId]
    );

    // Goal counts for this cycle (exclude shared template/parent goals owned by admin/manager)
    const { rows: goalRows } = await query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE g.status = 'draft')      AS draft,
        COUNT(*) FILTER (WHERE g.status = 'submitted')  AS submitted,
        COUNT(*) FILTER (WHERE g.status = 'approved')   AS approved,
        COUNT(*) FILTER (WHERE g.status = 'rework')     AS rework
      FROM goals g
      JOIN users u ON u.id = g.employee_id
      WHERE g.cycle_id = $1 AND u.role = 'employee' AND u.is_active = TRUE
    `, [cycleId]);

    const g = goalRows[0];
    const total     = Number(g.total);
    const submitted = Number(g.submitted);
    const approved  = Number(g.approved);

    const approvalRate   = total > 0 ? Math.round((approved  / total) * 100) : 0;
    const submissionRate = total > 0 ? Math.round(((submitted + approved) / total) * 100) : 0;

    return sendSuccess(res, {
      cycle: cycleRows[0] || null,
      users: {
        employees: Number(users.employees),
        managers:  Number(users.managers),
        admins:    Number(users.admins),
        total:     Number(users.total),
      },
      goals: {
        total,
        draft:     Number(g.draft),
        submitted,
        approved,
        rework:    Number(g.rework),
        approval_rate_pct:   approvalRate,
        submission_rate_pct: submissionRate,
      },
    }, 'Org stats fetched');
  } catch (err) { return sendError(res, err.message, 500); }
}

module.exports = {
  getCycles, createCycle, updateCycle,
  getThrustAreas, createThrustArea, updateThrustArea,
  getUsers, createUser, updateUser,
  pushSharedGoal,
  unlockGoal,
  getCompletionDashboard,
  getAuditLogs,
  getOrgStats,
};
