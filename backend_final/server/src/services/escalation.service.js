/**
 * escalation.service.js
 * GoalSync — Escalation rule evaluation engine.
 *
 * Called by the daily cron job (escalation.job.js).
 * Evaluates all active escalation rules against the current DB state
 * and sends emails + in-app notifications + writes escalation_logs.
 *
 * Three rule types (from the manual):
 *   1. goal_not_submitted  — employee hasn't submitted N days after phase1_start
 *   2. goal_not_approved   — manager has pending approvals older than N days
 *   3. checkin_not_done    — employee has no achievement entry in the open quarter
 *
 * Escalation path (two-level):
 *   - Level 1 (day N):    notify the immediate actor (employee or manager)
 *   - Level 2 (day 2×N):  notify their skip-level (manager's manager or HR)
 */

const { query } = require('../config/db');
const emailService = require('./email.service');
const notifService = require('./notification.service');

// ─── Helper: log to escalation_logs table ─────────────────────────────────────

async function logEscalation({ ruleId, targetUserId, notifiedUserId, reason }) {
  await query(
    `INSERT INTO escalation_logs (rule_id, target_user_id, notified_user_id, reason, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [ruleId, targetUserId, notifiedUserId, reason]
  );
}

/**
 * Check if we already notified this target user for this rule today.
 * Prevents duplicate emails on re-runs.
 */
async function alreadyEscalatedToday(ruleId, targetUserId) {
  const result = await query(
    `SELECT id FROM escalation_logs
     WHERE rule_id = $1
       AND target_user_id = $2
       AND created_at::date = CURRENT_DATE`,
    [ruleId, targetUserId]
  );
  return result.rows.length > 0;
}

// ─── Rule 1: goal_not_submitted ───────────────────────────────────────────────

async function evaluateGoalNotSubmitted(rule, cycle) {
  const phaseStart    = new Date(cycle.phase1_start);
  const now           = new Date();
  const daysSinceOpen = Math.floor((now - phaseStart) / 86400000);

  if (daysSinceOpen < rule.days_threshold) return; // Too early

  // Find employees who still have all goals in 'draft' or have no goals at all
  const result = await query(
    `SELECT
       u.id, u.name, u.email,
       u.manager_id,
       m.name  AS manager_name,
       m.email AS manager_email,
       mm.id   AS skip_manager_id,
       mm.name AS skip_manager_name,
       mm.email AS skip_manager_email,
       COUNT(g.id) FILTER (WHERE g.status IN ('submitted','approved')) AS submitted_count
     FROM users u
     LEFT JOIN users m  ON m.id = u.manager_id
     LEFT JOIN users mm ON mm.id = m.manager_id
     LEFT JOIN goals g  ON g.employee_id = u.id AND g.cycle_id = $1
     WHERE u.role = 'employee' AND u.is_active = TRUE
     GROUP BY u.id, u.name, u.email, u.manager_id,
              m.name, m.email, mm.id, mm.name, mm.email
     HAVING COUNT(g.id) FILTER (WHERE g.status IN ('submitted','approved')) = 0`,
    [cycle.id]
  );

  for (const emp of result.rows) {
    if (await alreadyEscalatedToday(rule.id, emp.id)) continue;

    const isLevel2 = daysSinceOpen >= rule.days_threshold * 2;
    const notifyEmail = isLevel2 && emp.skip_manager_email
      ? emp.skip_manager_email
      : emp.manager_email;
    const notifyName = isLevel2 && emp.skip_manager_name
      ? emp.skip_manager_name
      : emp.manager_name;
    const notifyId = isLevel2 && emp.skip_manager_id
      ? emp.skip_manager_id
      : emp.manager_id;

    if (!notifyEmail) continue;

    const reason = `${emp.name} has not submitted goals — ${daysSinceOpen} days since goal-setting opened`;

    await Promise.all([
      emailService.sendEscalationEmail({
        notifyEmail,
        notifyName,
        targetName:  emp.name,
        reason,
        ruleType:    'goal_not_submitted',
        daysOverdue: daysSinceOpen - rule.days_threshold,
      }),
      notifService.notifyEscalation({
        notifyUserId: notifyId,
        targetName:   emp.name,
        ruleType:     'goal_not_submitted',
      }),
      logEscalation({
        ruleId:         rule.id,
        targetUserId:   emp.id,
        notifiedUserId: notifyId,
        reason,
      }),
    ]);
  }
}

// ─── Rule 2: goal_not_approved ────────────────────────────────────────────────

async function evaluateGoalNotApproved(rule, cycle) {
  // Find managers who have goals in 'submitted' state older than threshold days
  const result = await query(
    `SELECT
       m.id AS manager_id, m.name AS manager_name, m.email AS manager_email,
       mm.id AS skip_id, mm.name AS skip_name, mm.email AS skip_email,
       u.id AS employee_id, u.name AS employee_name,
       MIN(g.updated_at) AS oldest_submission,
       COUNT(g.id) AS pending_count
     FROM goals g
     JOIN users u ON u.id = g.employee_id
     JOIN users m ON m.id = u.manager_id
     LEFT JOIN users mm ON mm.id = m.manager_id
     WHERE g.cycle_id = $1
       AND g.status = 'submitted'
       AND g.updated_at < NOW() - INTERVAL '1 day' * $2
     GROUP BY m.id, m.name, m.email, mm.id, mm.name, mm.email,
              u.id, u.name`,
    [cycle.id, rule.days_threshold]
  );

  for (const row of result.rows) {
    if (await alreadyEscalatedToday(rule.id, row.manager_id)) continue;

    const daysOverdue = Math.floor(
      (new Date() - new Date(row.oldest_submission)) / 86400000
    ) - rule.days_threshold;

    const isLevel2 = daysOverdue >= rule.days_threshold;
    const notifyEmail = isLevel2 && row.skip_email ? row.skip_email : row.manager_email;
    const notifyName  = isLevel2 && row.skip_name  ? row.skip_name  : row.manager_name;
    const notifyId    = isLevel2 && row.skip_id    ? row.skip_id    : row.manager_id;

    const reason = `${row.pending_count} goal(s) from ${row.employee_name} have been awaiting approval for ${daysOverdue + rule.days_threshold} days`;

    await Promise.all([
      emailService.sendEscalationEmail({
        notifyEmail,
        notifyName,
        targetName:  row.manager_name,
        reason,
        ruleType:    'goal_not_approved',
        daysOverdue,
      }),
      notifService.notifyEscalation({
        notifyUserId: notifyId,
        targetName:   row.manager_name,
        ruleType:     'goal_not_approved',
      }),
      logEscalation({
        ruleId:         rule.id,
        targetUserId:   row.manager_id,
        notifiedUserId: notifyId,
        reason,
      }),
    ]);
  }
}

// ─── Rule 3: checkin_not_done ─────────────────────────────────────────────────

async function evaluateCheckinNotDone(rule, cycle) {
  // Determine current open quarter
  const now = new Date();
  const quarters = ['q1', 'q2', 'q3', 'q4'];
  let openQuarter = null;

  for (const q of quarters) {
    const start = new Date(cycle[`${q}_start`]);
    const end   = new Date(cycle[`${q}_end`]);
    if (now >= start && now <= end) {
      openQuarter = q.toUpperCase();
      // Check if enough days have passed since window opened
      const daysIn = Math.floor((now - start) / 86400000);
      if (daysIn < rule.days_threshold) openQuarter = null;
      break;
    }
  }

  if (!openQuarter) return; // No open quarter or too early in the window

  // Find employees with approved goals but no achievement entry for this quarter
  const result = await query(
    `SELECT
       u.id, u.name, u.email,
       m.id AS manager_id, m.name AS manager_name, m.email AS manager_email
     FROM users u
     JOIN goals g ON g.employee_id = u.id AND g.cycle_id = $1 AND g.status = 'approved'
     JOIN users m ON m.id = u.manager_id
     WHERE u.role = 'employee' AND u.is_active = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM goal_achievements ga
         WHERE ga.goal_id = g.id
           AND ga.quarter = $2
           AND ga.actual_value IS NOT NULL
       )
     GROUP BY u.id, u.name, u.email, m.id, m.name, m.email`,
    [cycle.id, openQuarter]
  );

  for (const emp of result.rows) {
    if (await alreadyEscalatedToday(rule.id, emp.id)) continue;

    const reason = `${emp.name} has not logged achievements for ${openQuarter} yet`;

    await Promise.all([
      emailService.sendEscalationEmail({
        notifyEmail: emp.manager_email,
        notifyName:  emp.manager_name,
        targetName:  emp.name,
        reason,
        ruleType:    'checkin_not_done',
        daysOverdue: rule.days_threshold,
      }),
      notifService.notifyEscalation({
        notifyUserId: emp.manager_id,
        targetName:   emp.name,
        ruleType:     'checkin_not_done',
      }),
      logEscalation({
        ruleId:         rule.id,
        targetUserId:   emp.id,
        notifiedUserId: emp.manager_id,
        reason,
      }),
    ]);
  }
}

// ─── Main evaluator ───────────────────────────────────────────────────────────

/**
 * Run all active escalation rules against the active cycle.
 * Called by the cron job daily at 8 AM.
 *
 * @returns {Promise<{rulesRun: number, errors: string[]}>}
 */
async function runEscalationRules() {
  const errors = [];
  let rulesRun = 0;

  try {
    // Get active cycle
    const cycleResult = await query(
      `SELECT * FROM goal_cycles WHERE is_active = TRUE LIMIT 1`
    );
    if (!cycleResult.rows.length) {
      console.log('[escalation] No active cycle — skipping');
      return { rulesRun: 0, errors: [] };
    }
    const cycle = cycleResult.rows[0];

    // Get active rules
    const rulesResult = await query(
      `SELECT * FROM escalation_rules WHERE is_active = TRUE ORDER BY created_at`
    );

    for (const rule of rulesResult.rows) {
      try {
        console.log(`[escalation] evaluating rule: ${rule.rule_type} (threshold: ${rule.days_threshold}d)`);

        switch (rule.rule_type) {
          case 'goal_not_submitted':
            await evaluateGoalNotSubmitted(rule, cycle);
            break;
          case 'goal_not_approved':
            await evaluateGoalNotApproved(rule, cycle);
            break;
          case 'checkin_not_done':
            await evaluateCheckinNotDone(rule, cycle);
            break;
          default:
            console.warn(`[escalation] unknown rule_type: ${rule.rule_type}`);
        }
        rulesRun++;
      } catch (err) {
        const msg = `Rule ${rule.rule_type} failed: ${err.message}`;
        console.error(`[escalation] ${msg}`);
        errors.push(msg);
      }
    }
  } catch (err) {
    errors.push(`Fatal escalation error: ${err.message}`);
    console.error('[escalation] fatal:', err);
  }

  return { rulesRun, errors };
}

module.exports = { runEscalationRules };
