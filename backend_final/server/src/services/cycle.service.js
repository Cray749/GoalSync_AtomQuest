// server/src/services/cycle.service.js
//
// Determines which cycle window is currently open.
// Used to gate goal submission and achievement entry.

'use strict';

const { query } = require('../config/db');

/**
 * Returns the currently active cycle, or null if none.
 * @returns {Promise<object|null>}
 */
async function getActiveCycle() {
  const { rows } = await query(
    'SELECT * FROM goal_cycles WHERE is_active = TRUE LIMIT 1'
  );
  return rows[0] || null;
}

/**
 * Returns the active window name for a given cycle object.
 *
 * @param {object} cycle  - row from goal_cycles
 * @returns {'phase1'|'q1'|'q2'|'q3'|'q4'|null}
 */
function getActiveWindow(cycle) {
  if (!cycle) return null;

  const now = new Date();

  const windows = [
    { name: 'phase1', start: new Date(cycle.phase1_start), end: new Date(cycle.phase1_end) },
    { name: 'q1',     start: new Date(cycle.q1_start),     end: new Date(cycle.q1_end)     },
    { name: 'q2',     start: new Date(cycle.q2_start),     end: new Date(cycle.q2_end)     },
    { name: 'q3',     start: new Date(cycle.q3_start),     end: new Date(cycle.q3_end)     },
    { name: 'q4',     start: new Date(cycle.q4_start),     end: new Date(cycle.q4_end)     },
  ];

  for (const w of windows) {
    // Set end to end-of-day so the last day is fully included
    const endOfDay = new Date(w.end);
    endOfDay.setHours(23, 59, 59, 999);
    if (now >= w.start && now <= endOfDay) return w.name;
  }

  return null;
}

/**
 * Maps a window name to the corresponding quarter string.
 * phase1 → null (goal setting, not a quarter)
 */
function windowToQuarter(window) {
  const map = { q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4' };
  return map[window] || null;
}

/**
 * Returns the active window + quarter for the currently active cycle.
 * Convenience wrapper used by controllers.
 *
 * @returns {Promise<{ cycle: object, window: string|null, quarter: string|null }>}
 */
async function getActiveCycleWindow() {
  const cycle  = await getActiveCycle();
  const window = getActiveWindow(cycle);
  return {
    cycle,
    window,
    quarter: windowToQuarter(window),
    is_goal_setting_open: window === 'phase1',
    is_checkin_open: ['q1', 'q2', 'q3', 'q4'].includes(window),
  };
}

/**
 * Returns all quarters that have passed or are currently open for a cycle.
 * Used to determine which actuals an employee can view.
 *
 * @param {object} cycle
 * @returns {string[]}  e.g. ['Q1', 'Q2']
 */
function getCompletedOrOpenQuarters(cycle) {
  if (!cycle) return [];
  const now = new Date();
  const quarters = [];

  if (now >= new Date(cycle.q1_start)) quarters.push('Q1');
  if (now >= new Date(cycle.q2_start)) quarters.push('Q2');
  if (now >= new Date(cycle.q3_start)) quarters.push('Q3');
  if (now >= new Date(cycle.q4_start)) quarters.push('Q4');

  return quarters;
}

module.exports = {
  getActiveCycle,
  getActiveWindow,
  windowToQuarter,
  getActiveCycleWindow,
  getCompletedOrOpenQuarters,
};
