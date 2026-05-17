/**
 * notification.service.js
 * GoalSync — In-app notification service.
 *
 * Creates entries in the `notifications` table that are surfaced
 * via the notification bell in the frontend NavBar.
 *
 * Every email trigger also creates a parallel in-app notification so
 * users see alerts even if email delivery is delayed or blocked.
 *
 * Usage:
 *   const notifService = require('./notification.service');
 *   await notifService.createNotification({
 *     userId, title, message, link
 *   });
 */

const { query } = require('../config/db');

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a single in-app notification for a user.
 *
 * @param {object} opts
 * @param {string}      opts.userId   - recipient user UUID
 * @param {string}      opts.title    - short title (max ~80 chars)
 * @param {string}      opts.message  - body text (max ~400 chars)
 * @param {string|null} opts.link     - deep link in the SPA (e.g. '/employee/goals')
 * @returns {Promise<object>} created notification row
 */
async function createNotification({ userId, title, message, link = null }) {
  const result = await query(
    `INSERT INTO notifications (user_id, title, message, link, is_read, created_at)
     VALUES ($1, $2, $3, $4, FALSE, NOW())
     RETURNING *`,
    [userId, title, message, link]
  );
  return result.rows[0];
}

/**
 * Bulk-create notifications for multiple users (e.g., quarter window open).
 *
 * @param {Array<{userId, title, message, link}>} items
 * @returns {Promise<number>} count of created notifications
 */
async function createBulkNotifications(items) {
  if (!items?.length) return 0;

  // Build parameterized bulk insert
  const values = [];
  const params = [];
  let paramIdx = 1;

  items.forEach(({ userId, title, message, link }) => {
    values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, FALSE, NOW())`);
    params.push(userId, title, message, link || null);
  });

  const result = await query(
    `INSERT INTO notifications (user_id, title, message, link, is_read, created_at)
     VALUES ${values.join(', ')}
     RETURNING id`,
    params
  );
  return result.rows.length;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get notifications for a user, newest first.
 * Used by GET /api/notifications — the bell dropdown.
 *
 * @param {string} userId
 * @param {object} opts
 * @param {number} opts.limit   - default 20
 * @param {number} opts.offset  - for pagination
 * @param {boolean|null} opts.unreadOnly
 * @returns {Promise<{notifications: object[], unreadCount: number}>}
 */
async function getUserNotifications(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
  const whereExtra = unreadOnly ? 'AND is_read = FALSE' : '';

  const [notifResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM notifications
       WHERE user_id = $1 ${whereExtra}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    query(
      `SELECT COUNT(*) AS count FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    ),
  ]);

  return {
    notifications: notifResult.rows,
    unreadCount:   parseInt(countResult.rows[0]?.count || 0, 10),
  };
}

// ─── Mark read ────────────────────────────────────────────────────────────────

/**
 * Mark a single notification as read.
 * @param {string} notificationId
 * @param {string} userId - must match to prevent cross-user attacks
 */
async function markAsRead(notificationId, userId) {
  await query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

/**
 * Mark ALL of a user's notifications as read.
 * @param {string} userId
 * @returns {Promise<number>} count updated
 */
async function markAllAsRead(userId) {
  const result = await query(
    `UPDATE notifications SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE
     RETURNING id`,
    [userId]
  );
  return result.rows.length;
}

// ─── Convenience wrappers (called from controllers after email triggers) ──────

/** Trigger 1: Goals submitted → manager */
async function notifyGoalsSubmitted({ managerId, employeeName, goalCount, cycleName, employeeId }) {
  return createNotification({
    userId:  managerId,
    title:   `${employeeName} submitted goals`,
    message: `${goalCount} goal${goalCount !== 1 ? 's' : ''} awaiting your approval for ${cycleName}`,
    link:    `/manager/approvals?employee=${employeeId}`,
  });
}

/** Trigger 2: Goals approved → employee */
async function notifyGoalsApproved({ employeeId, managerName, approvedCount, cycleName }) {
  return createNotification({
    userId:  employeeId,
    title:   'Your goals have been approved ✅',
    message: `${managerName} approved ${approvedCount} goal${approvedCount !== 1 ? 's' : ''} for ${cycleName}`,
    link:    '/employee/goals',
  });
}

/** Trigger 3: Goals returned for rework → employee */
async function notifyGoalsRework({ employeeId, managerName, goalTitle }) {
  return createNotification({
    userId:  employeeId,
    title:   'Goal returned for revision',
    message: `${managerName} returned "${goalTitle}" — please revise and resubmit`,
    link:    '/employee/goals',
  });
}

/** Trigger 4: Quarter window opens → all employees */
async function notifyQuarterOpen({ employeeIds, quarter, cycleName }) {
  const items = employeeIds.map(userId => ({
    userId,
    title:   `${quarter} check-in window is open`,
    message: `Log your achievements for ${cycleName} before the deadline`,
    link:    '/employee/checkin',
  }));
  return createBulkNotifications(items);
}

/** Trigger 5: Escalation → manager / HR */
async function notifyEscalation({ notifyUserId, targetName, ruleType }) {
  const msgMap = {
    goal_not_submitted: `${targetName} has not submitted their goals`,
    goal_not_approved:  `${targetName}'s goals are pending your approval`,
    checkin_not_done:   `${targetName} has not completed their check-in`,
  };
  return createNotification({
    userId:  notifyUserId,
    title:   '⚠ Escalation alert',
    message: msgMap[ruleType] || `Action required for ${targetName}`,
    link:    '/manager/team',
  });
}

module.exports = {
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  notifyGoalsSubmitted,
  notifyGoalsApproved,
  notifyGoalsRework,
  notifyQuarterOpen,
  notifyEscalation,
};
