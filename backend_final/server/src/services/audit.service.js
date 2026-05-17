/**
 * audit.service.js
 * GoalSync — Audit log writer.
 * Called whenever a locked goal is modified or an admin performs a sensitive action.
 *
 * This is the Session 7 superset version — adds getAuditLogs() + console logging.
 * writeNotification() retained from Session 2 (used by manager & admin controllers).
 */

'use strict';

const { query } = require('../config/db');

/**
 * Write a single audit log entry.
 *
 * @param {object} opts
 * @param {string|null} opts.goalId     - UUID of affected goal (nullable for user-level actions)
 * @param {string}      opts.userId     - UUID of the user performing the action
 * @param {string}      opts.action     - e.g. 'goal_unlocked', 'goal_approved', 'goal_rework'
 * @param {string|null} opts.fieldName  - which field changed (nullable)
 * @param {string|null} opts.oldValue   - previous value as string (nullable)
 * @param {string|null} opts.newValue   - new value as string (nullable)
 * @param {string|null} opts.ipAddress  - request IP (nullable)
 * @param {import('pg').PoolClient} [opts.client] - optional transaction client
 * @returns {Promise<object>} the created audit log row
 */
async function writeAuditLog({
  goalId     = null,
  userId,
  action,
  fieldName  = null,
  oldValue   = null,
  newValue   = null,
  ipAddress  = null,
  client     = null,
}) {
  if (!userId) throw new Error('writeAuditLog: userId is required');
  if (!action) throw new Error('writeAuditLog: action is required');

  const sql = `
    INSERT INTO audit_logs
      (goal_id, user_id, action, field_name, old_value, new_value, ip_address, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING *
  `;
  const params = [goalId, userId, action, fieldName, oldValue, newValue, ipAddress];

  let row;
  if (client) {
    const { rows } = await client.query(sql, params);
    row = rows[0];
  } else {
    const { rows } = await query(sql, params);
    row = rows[0];
  }

  console.log(`[audit] ${action} | user=${userId} | goal=${goalId || 'n/a'}`);
  return row;
}

/**
 * Write a notification for a user.
 * Retained from Session 2 — used by manager.controller and admin.controller.
 *
 * @param {object} opts
 * @param {string}  opts.userId
 * @param {string}  opts.title
 * @param {string}  opts.message
 * @param {string}  [opts.link]
 * @param {import('pg').PoolClient} [opts.client]
 */
async function writeNotification({ userId, title, message, link = null, client = null }) {
  const sql = `
    INSERT INTO notifications (user_id, title, message, link)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `;
  const params = [userId, title, message, link];

  if (client) {
    const { rows } = await client.query(sql, params);
    return rows[0];
  }
  const { rows } = await query(sql, params);
  return rows[0];
}

/**
 * Fetch paginated audit logs — used by admin/AuditLogTable UI.
 * Added in Session 7 (superset over Session 2's inline SQL in admin.controller).
 *
 * @param {object} opts
 * @param {string|null} opts.goalId   - filter by goal
 * @param {string|null} opts.userId   - filter by actor
 * @param {string|null} opts.action   - filter by action type
 * @param {number}      opts.limit
 * @param {number}      opts.offset
 * @returns {Promise<{rows: object[], total: number}>}
 */
async function getAuditLogs({ goalId = null, userId = null, action = null, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (goalId) { params.push(goalId);         conditions.push(`al.goal_id = $${params.length}`); }
  if (userId) { params.push(userId);         conditions.push(`al.user_id = $${params.length}`); }
  if (action) { params.push(`%${action}%`);  conditions.push(`al.action ILIKE $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);

  const [rowsResult, countResult] = await Promise.all([
    query(
      `SELECT
         al.*,
         u.name  AS actor_name,
         u.role  AS actor_role,
         g.title AS goal_title
       FROM audit_logs al
       JOIN users u ON u.id = al.user_id
       LEFT JOIN goals g ON g.id = al.goal_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    ),
    query(
      `SELECT COUNT(*) AS total FROM audit_logs al ${where}`,
      params.slice(0, params.length - 2)
    ),
  ]);

  return {
    rows:  rowsResult.rows,
    total: parseInt(countResult.rows[0]?.total || 0, 10),
  };
}

module.exports = { writeAuditLog, writeNotification, getAuditLogs };
