// server/src/services/goal.service.js
//
// All business logic for goal creation, validation, submission,
// and the lock/unlock lifecycle.

'use strict';

const { query, withTransaction } = require('../config/db');
const { writeAuditLog, writeNotification } = require('./audit.service');

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────
const MAX_GOALS_PER_CYCLE = 8;
const MIN_WEIGHTAGE       = 10;
const TOTAL_WEIGHTAGE     = 100;
const WEIGHTAGE_TOLERANCE = 0.01; // floating point tolerance

// ──────────────────────────────────────────────────────────────
// Read helpers
// ──────────────────────────────────────────────────────────────

/**
 * Get all goals for an employee in a cycle, enriched with thrust area name.
 */
async function getGoalsByEmployee(employeeId, cycleId) {
  const { rows } = await query(`
    SELECT g.*,
           ta.name AS thrust_area_name,
           u.name  AS employee_name
    FROM goals g
    LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
    LEFT JOIN users u         ON u.id  = g.employee_id
    WHERE g.employee_id = $1
      AND g.cycle_id    = $2
    ORDER BY g.created_at ASC
  `, [employeeId, cycleId]);
  return rows;
}

/**
 * Get a single goal by ID.
 * Optionally verifies ownership (throws if mismatch).
 */
async function getGoalById(goalId, ownerEmployeeId = null) {
  const { rows } = await query(`
    SELECT g.*,
           ta.name AS thrust_area_name,
           u.name  AS employee_name,
           m.name  AS manager_name
    FROM goals g
    LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
    LEFT JOIN users u         ON u.id  = g.employee_id
    LEFT JOIN users m         ON m.id  = u.manager_id
    WHERE g.id = $1
  `, [goalId]);

  const goal = rows[0];
  if (!goal) {
    const err = new Error('Goal not found');
    err.status = 404;
    throw err;
  }

  if (ownerEmployeeId && goal.employee_id !== ownerEmployeeId) {
    const err = new Error('Access denied — this goal does not belong to you');
    err.status = 403;
    throw err;
  }

  return goal;
}

// ──────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────

/**
 * Validate a single goal's fields before INSERT or UPDATE.
 * Throws a descriptive error on any violation.
 */
function validateGoalFields(data) {
  const { title, uom_type, target_value, target_date, weightage } = data;

  if (!title || title.trim().length < 3) {
    throw Object.assign(new Error('Goal title must be at least 3 characters'), { status: 400 });
  }
  if (title.trim().length > 255) {
    throw Object.assign(new Error('Goal title must be under 255 characters'), { status: 400 });
  }

  const validUom = ['min', 'max', 'timeline', 'zero'];
  if (!uom_type || !validUom.includes(uom_type)) {
    throw Object.assign(new Error(`UoM type must be one of: ${validUom.join(', ')}`), { status: 400 });
  }

  if (['min', 'max'].includes(uom_type)) {
    if (target_value === null || target_value === undefined || target_value === '') {
      throw Object.assign(new Error('Target value is required for min/max goals'), { status: 400 });
    }
    if (Number(target_value) <= 0) {
      throw Object.assign(new Error('Target value must be a positive number'), { status: 400 });
    }
  }

  if (uom_type === 'timeline') {
    if (!target_date) {
      throw Object.assign(new Error('Target date is required for timeline goals'), { status: 400 });
    }
    if (new Date(target_date) <= new Date()) {
      throw Object.assign(new Error('Target date must be in the future'), { status: 400 });
    }
  }

  if (weightage === null || weightage === undefined || weightage === '') {
    throw Object.assign(new Error('Weightage is required'), { status: 400 });
  }
  if (Number(weightage) < MIN_WEIGHTAGE) {
    throw Object.assign(new Error(`Minimum weightage per goal is ${MIN_WEIGHTAGE}%`), { status: 400 });
  }
  if (Number(weightage) > 90) {
    throw Object.assign(new Error('Maximum weightage per goal is 90%'), { status: 400 });
  }
}

/**
 * Validate the full goal sheet before submission.
 * Checks: count ≤ 8, each ≥ 10%, total = 100%.
 *
 * @param {string} employeeId
 * @param {string} cycleId
 * @throws {Error} with .status = 400 on any violation
 */
async function validateGoalSheet(employeeId, cycleId) {
  const goals = await getGoalsByEmployee(employeeId, cycleId);

  // Only validate draft goals (rework goals are re-submitted too)
  const submittable = goals.filter(g =>
    ['draft', 'rework'].includes(g.status)
  );

  // Must have at least one goal to submit
  const allGoals = goals.filter(g => g.status !== 'approved');
  if (allGoals.length === 0 && goals.filter(g => g.status === 'approved').length === 0) {
    throw Object.assign(new Error('No goals to submit'), { status: 400 });
  }

  // Count ALL non-approved goals (already approved stay, drafts get submitted)
  const draftAndRework = goals.filter(g => ['draft', 'rework'].includes(g.status));
  const approved       = goals.filter(g => g.status === 'approved');

  if (draftAndRework.length === 0) {
    throw Object.assign(new Error('No draft or rework goals to submit'), { status: 400 });
  }

  const totalGoals = goals.length; // all statuses
  if (totalGoals > MAX_GOALS_PER_CYCLE) {
    throw Object.assign(
      new Error(`Maximum ${MAX_GOALS_PER_CYCLE} goals allowed per cycle. You have ${totalGoals}.`),
      { status: 400 }
    );
  }

  // Weightage check across ALL goals (approved + about-to-be-submitted)
  const totalWeightage = goals.reduce((sum, g) => sum + parseFloat(g.weightage || 0), 0);
  if (Math.abs(totalWeightage - TOTAL_WEIGHTAGE) > WEIGHTAGE_TOLERANCE) {
    throw Object.assign(
      new Error(`Total weightage must be exactly 100%. Currently: ${totalWeightage.toFixed(2)}%`),
      { status: 400 }
    );
  }

  const underMin = goals.filter(g => parseFloat(g.weightage) < MIN_WEIGHTAGE);
  if (underMin.length > 0) {
    const titles = underMin.map(g => `"${g.title}"`).join(', ');
    throw Object.assign(
      new Error(`Goals must have minimum ${MIN_WEIGHTAGE}% weightage: ${titles}`),
      { status: 400 }
    );
  }

  return goals;
}

// ──────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────

/**
 * Create a new goal (status = draft).
 */
async function createGoal(employeeId, cycleId, data) {
  // Check count before creating
  const existing = await getGoalsByEmployee(employeeId, cycleId);
  if (existing.length >= MAX_GOALS_PER_CYCLE) {
    throw Object.assign(
      new Error(`Maximum ${MAX_GOALS_PER_CYCLE} goals allowed per cycle`),
      { status: 400 }
    );
  }

  validateGoalFields(data);

  const {
    thrust_area_id = null,
    title,
    description   = null,
    uom_type,
    target_value  = null,
    target_date   = null,
    weightage,
  } = data;

  const { rows } = await query(`
    INSERT INTO goals
      (employee_id, cycle_id, thrust_area_id, title, description,
       uom_type, target_value, target_date, weightage, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft')
    RETURNING *
  `, [employeeId, cycleId, thrust_area_id, title.trim(), description,
      uom_type, target_value || null, target_date || null, weightage]);

  return rows[0];
}

/**
 * Update a goal. Only allowed when status = 'draft' or 'rework'.
 * Shared goals: only weightage is editable (title/target read-only).
 */
async function updateGoal(goalId, employeeId, data) {
  const goal = await getGoalById(goalId, employeeId);

  if (!['draft', 'rework'].includes(goal.status)) {
    throw Object.assign(
      new Error('Only draft or rework goals can be edited'),
      { status: 400 }
    );
  }
  if (goal.is_locked) {
    throw Object.assign(new Error('Goal is locked — contact Admin to unlock'), { status: 403 });
  }

  // Shared goals: only weightage can change
  if (goal.is_shared) {
    const { weightage } = data;
    if (!weightage || Number(weightage) < MIN_WEIGHTAGE) {
      throw Object.assign(new Error(`Minimum weightage is ${MIN_WEIGHTAGE}%`), { status: 400 });
    }
    const { rows } = await query(
      'UPDATE goals SET weightage = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [weightage, goalId]
    );
    return rows[0];
  }

  validateGoalFields({ ...goal, ...data });

  const {
    thrust_area_id = goal.thrust_area_id,
    title          = goal.title,
    description    = goal.description,
    uom_type       = goal.uom_type,
    target_value   = goal.target_value,
    target_date    = goal.target_date,
    weightage      = goal.weightage,
  } = data;

  const { rows } = await query(`
    UPDATE goals SET
      thrust_area_id = $1,
      title          = $2,
      description    = $3,
      uom_type       = $4,
      target_value   = $5,
      target_date    = $6,
      weightage      = $7,
      updated_at     = NOW()
    WHERE id = $8
    RETURNING *
  `, [thrust_area_id, title.trim(), description, uom_type,
      target_value || null, target_date || null, weightage, goalId]);

  return rows[0];
}

/**
 * Delete a goal. Only draft, not-yet-submitted goals.
 */
async function deleteGoal(goalId, employeeId) {
  const goal = await getGoalById(goalId, employeeId);

  if (goal.status !== 'draft') {
    throw Object.assign(
      new Error('Only draft goals can be deleted'),
      { status: 400 }
    );
  }

  await query('DELETE FROM goals WHERE id = $1', [goalId]);
  return true;
}

// ──────────────────────────────────────────────────────────────
// Submit
// ──────────────────────────────────────────────────────────────

/**
 * Submit all draft/rework goals for an employee.
 * Validates the full sheet, then flips status → 'submitted'.
 * Notifies the manager.
 */
async function submitGoals(employeeId, cycleId, ipAddress = null) {
  // This validates and throws on any violation
  const goals = await validateGoalSheet(employeeId, cycleId);

  const toSubmit = goals.filter(g => ['draft', 'rework'].includes(g.status));

  return withTransaction(async (client) => {
    // Flip status on all draft/rework goals
    for (const g of toSubmit) {
      await client.query(
        "UPDATE goals SET status = 'submitted', rework_comment = NULL, updated_at = NOW() WHERE id = $1",
        [g.id]
      );
    }

    // Look up manager
    const { rows: empRows } = await client.query(
      'SELECT manager_id, name FROM users WHERE id = $1',
      [employeeId]
    );
    const emp = empRows[0];

    if (emp?.manager_id) {
      await writeNotification({
        userId:  emp.manager_id,
        title:   'Goals submitted for review',
        message: `${emp.name} has submitted ${toSubmit.length} goal(s) for your approval.`,
        link:    '/manager/approvals',
        client,
      });
    }

    // Audit log
    await writeAuditLog({
      goalId:    null,
      userId:    employeeId,
      action:    'goals_submitted',
      newValue:  `${toSubmit.length} goals submitted`,
      ipAddress,
      client,
    });

    return { submitted: toSubmit.length };
  });
}

// ──────────────────────────────────────────────────────────────
// Thrust Areas (read — admin creates them)
// ──────────────────────────────────────────────────────────────

async function getThrustAreasByCycle(cycleId) {
  const { rows } = await query(
    'SELECT * FROM thrust_areas WHERE cycle_id = $1 AND is_active = TRUE ORDER BY name',
    [cycleId]
  );
  return rows;
}

module.exports = {
  getGoalsByEmployee,
  getGoalById,
  validateGoalFields,
  validateGoalSheet,
  createGoal,
  updateGoal,
  deleteGoal,
  submitGoals,
  getThrustAreasByCycle,
  MAX_GOALS_PER_CYCLE,
  MIN_WEIGHTAGE,
};
