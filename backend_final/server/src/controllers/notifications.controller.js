/**
 * notifications.controller.js
 * GoalSync — Notification endpoint handlers.
 */

const notifService  = require('../services/notification.service');
const emailService  = require('../services/email.service');
const { query }     = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { triggerManualRun } = require('../jobs/escalation.job');

// ─── GET /api/notifications ────────────────────────────────────────────────────
exports.getMyNotifications = async (req, res) => {
  try {
    const limit      = Math.min(parseInt(req.query.limit  || '20', 10), 100);
    const offset     = parseInt(req.query.offset || '0', 10);
    const unreadOnly = req.query.unread === 'true';

    const { notifications, unreadCount } = await notifService.getUserNotifications(
      req.user.id,
      { limit, offset, unreadOnly }
    );

    return sendSuccess(res, { notifications, unreadCount, limit, offset });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─── PATCH /api/notifications/:id/read ────────────────────────────────────────
exports.markOneRead = async (req, res) => {
  try {
    await notifService.markAsRead(req.params.id, req.user.id);
    return sendSuccess(res, null, 'Notification marked as read');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─── PATCH /api/notifications/read-all ────────────────────────────────────────
exports.markAllRead = async (req, res) => {
  try {
    const count = await notifService.markAllAsRead(req.user.id);
    return sendSuccess(res, { count }, `${count} notification(s) marked as read`);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─── DELETE /api/notifications/:id ────────────────────────────────────────────
exports.deleteNotification = async (req, res) => {
  try {
    await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    return sendSuccess(res, null, 'Notification deleted');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─── POST /api/notifications/broadcast (admin) ────────────────────────────────
exports.broadcastQuarterOpen = async (req, res) => {
  try {
    const { quarter, cycle_id } = req.body;
    if (!quarter || !['Q1','Q2','Q3','Q4'].includes(quarter)) {
      return sendError(res, 'Valid quarter (Q1–Q4) is required', 400);
    }

    // Get cycle
    const cycleResult = await query(
      cycle_id
        ? `SELECT * FROM goal_cycles WHERE id = $1`
        : `SELECT * FROM goal_cycles WHERE is_active = TRUE LIMIT 1`,
      cycle_id ? [cycle_id] : []
    );
    if (!cycleResult.rows.length) return sendError(res, 'No active cycle found', 404);
    const cycle = cycleResult.rows[0];

    const qKey = quarter.toLowerCase();
    const windowEnd = cycle[`${qKey}_end`];

    // Get all active employees
    const empResult = await query(
      `SELECT id, name, email FROM users WHERE role = 'employee' AND is_active = TRUE`
    );
    const employees    = empResult.rows.map(r => ({ email: r.email, name: r.name }));
    const employeeIds  = empResult.rows.map(r => r.id);

    const [emailResult, notifCount] = await Promise.all([
      emailService.sendQuarterOpenEmail({
        employees,
        quarter,
        cycleName: cycle.name,
        windowEnd,
      }),
      notifService.notifyQuarterOpen({ employeeIds, quarter, cycleName: cycle.name }),
    ]);

    return sendSuccess(res, {
      emailsSent:   emailResult.sent,
      emailsFailed: emailResult.failed,
      notifCreated: notifCount,
    }, `${quarter} broadcast sent to ${employees.length} employees`);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─── POST /api/admin/escalations/run (admin) ──────────────────────────────────
exports.runEscalationsManually = async (req, res) => {
  try {
    const result = await triggerManualRun();
    return sendSuccess(res, result, 'Escalation run complete');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) AS count FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    return sendSuccess(res, { count: parseInt(rows[0].count, 10) });
  } catch (err) {
    return sendError(res, err);
  }
};

