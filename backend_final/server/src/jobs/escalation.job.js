/**
 * escalation.job.js
 * GoalSync — Daily escalation cron job.
 *
 * Runs at 8:00 AM every day (server local time).
 * Evaluates all active escalation rules and sends notifications.
 *
 * Also handles the quarter window open notification — checks if today
 * is the first day of a new quarter window and broadcasts to all employees.
 *
 * Start this in server.js after DB connects:
 *   const { startEscalationJob } = require('./jobs/escalation.job');
 *   startEscalationJob();
 */

const cron = require('node-cron');
const { runEscalationRules } = require('../services/escalation.service');
const { query } = require('../config/db');
const emailService = require('../services/email.service');
const notifService = require('../services/notification.service');

// ─── Quarter window open broadcast ────────────────────────────────────────────

/**
 * Check if today marks the opening of a new quarter window.
 * If yes, send the broadcast email + in-app notification to all active employees.
 */
async function checkAndBroadcastQuarterOpen() {
  try {
    const cycleResult = await query(
      `SELECT * FROM goal_cycles WHERE is_active = TRUE LIMIT 1`
    );
    if (!cycleResult.rows.length) return;
    const cycle = cycleResult.rows[0];

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const quarters = [
      { key: 'q1', label: 'Q1' },
      { key: 'q2', label: 'Q2' },
      { key: 'q3', label: 'Q3' },
      { key: 'q4', label: 'Q4' },
    ];

    let openedQuarter = null;
    let windowEnd     = null;

    for (const q of quarters) {
      const startStr = new Date(cycle[`${q.key}_start`]).toISOString().slice(0, 10);
      if (startStr === today) {
        openedQuarter = q.label;
        windowEnd     = cycle[`${q.key}_end`];
        break;
      }
    }

    if (!openedQuarter) return; // Not a quarter-open day

    console.log(`[cron] 🎉 ${openedQuarter} window opened today — broadcasting to employees`);

    // Fetch all active employees
    const empResult = await query(
      `SELECT id, name, email FROM users
       WHERE role = 'employee' AND is_active = TRUE`
    );
    const employees = empResult.rows.map(r => ({ email: r.email, name: r.name }));
    const employeeIds = empResult.rows.map(r => r.id);

    // Fire both email + in-app in parallel
    const [emailResult, notifCount] = await Promise.all([
      emailService.sendQuarterOpenEmail({
        employees,
        quarter:   openedQuarter,
        cycleName: cycle.name,
        windowEnd,
      }),
      notifService.notifyQuarterOpen({
        employeeIds,
        quarter:   openedQuarter,
        cycleName: cycle.name,
      }),
    ]);

    console.log(
      `[cron] Quarter open broadcast: ${emailResult.sent} emails sent, ` +
      `${emailResult.failed} failed, ${notifCount} in-app notifications created`
    );
  } catch (err) {
    console.error('[cron] Quarter open check failed:', err.message);
  }
}

// ─── Main cron runner ─────────────────────────────────────────────────────────

let scheduledTask = null;

/**
 * Start the daily 8 AM escalation cron job.
 * Safe to call multiple times — won't create duplicate jobs.
 */
function startEscalationJob() {
  if (scheduledTask) {
    console.log('[cron] Escalation job already running');
    return;
  }

  // '0 8 * * *' = at 08:00 every day
  scheduledTask = cron.schedule('0 8 * * *', async () => {
    console.log(`[cron] ⏰ Daily escalation job started at ${new Date().toISOString()}`);

    // Step 1: Check if a new quarter window opened today
    await checkAndBroadcastQuarterOpen();

    // Step 2: Run all escalation rules
    const { rulesRun, errors } = await runEscalationRules();

    console.log(
      `[cron] ✓ Escalation job complete: ${rulesRun} rules evaluated, ` +
      `${errors.length} errors`
    );
    if (errors.length) {
      console.error('[cron] Errors:', errors);
    }
  }, {
    scheduled: true,
    timezone:  process.env.CRON_TIMEZONE || 'Asia/Kolkata', // IST default for AtomQuest
  });

  console.log('[cron] ✓ Escalation job scheduled — runs daily at 08:00 IST');
}

/**
 * Stop the cron job (useful for graceful shutdown).
 */
function stopEscalationJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[cron] Escalation job stopped');
  }
}

/**
 * Manually trigger one run (for admin "run now" endpoint or testing).
 * @returns {Promise<{rulesRun, errors}>}
 */
async function triggerManualRun() {
  console.log('[cron] Manual escalation run triggered');
  await checkAndBroadcastQuarterOpen();
  return runEscalationRules();
}

module.exports = { startEscalationJob, stopEscalationJob, triggerManualRun };
