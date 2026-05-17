// server/src/services/score.service.js
//
// THE canonical score calculation for GoalSync.
// This file is the single source of truth — the frontend mirrors
// these exact formulas in client/src/utils/scoreCalc.js.
//
// Returns a ratio (0–1+). Multiply by 100 for display %.
// Cap display at 150 % to handle overachievement gracefully.
//
// UoM types:
//   min      — higher actual is better  (Sales Revenue, NPS)
//   max      — lower actual is better   (TAT, Cost, Defects)
//   timeline — date-based completion
//   zero     — zero = success            (Safety incidents)

'use strict';

/**
 * Core score ratio for a single goal.
 *
 * @param {string}      uomType        'min' | 'max' | 'timeline' | 'zero'
 * @param {number|null} target         numeric target (null for zero/timeline)
 * @param {number|null} actual         actual value logged by employee
 * @param {Date|string|null} targetDate     deadline (timeline UoM)
 * @param {Date|string|null} completionDate actual completion date (timeline UoM)
 * @returns {number} score ratio — 0 to 1+ (>1 means overachievement)
 */
function calculateScore(uomType, target, actual, targetDate = null, completionDate = null) {
  switch (uomType) {
    case 'min': {
      // Higher is better — e.g. Sales Revenue, NPS, Certifications
      // Formula: actual ÷ target
      if (!target || Number(target) === 0) return 0;
      if (actual === null || actual === undefined) return 0;
      return Number(actual) / Number(target);
    }

    case 'max': {
      // Lower is better — e.g. TAT (days), Cost, Error rate
      // Formula: target ÷ actual  (achieving less than target = overachievement)
      if (actual === null || actual === undefined) return 0;
      if (Number(actual) === 0) return 1.5; // achieved zero = maximum score (cap at 150%)
      if (!target || Number(target) === 0) return 0;
      return Number(target) / Number(actual);
    }

    case 'timeline': {
      // Date-based — completed on/before deadline = 100%, late = 50%
      if (!completionDate) return 0; // not completed yet
      const deadline  = new Date(targetDate).getTime();
      const completed = new Date(completionDate).getTime();
      if (isNaN(deadline) || isNaN(completed)) return 0;
      if (completed <= deadline) return 1;   // on time or early
      return 0.5;                            // late — proportional penalty
    }

    case 'zero': {
      // Zero = success (Safety incidents, defects, escalations)
      if (actual === null || actual === undefined) return 0;
      return Number(actual) === 0 ? 1 : 0;
    }

    default:
      return 0;
  }
}

/**
 * Display-friendly percentage string.
 * Caps at 150 % to handle overachievement gracefully.
 *
 * @param {number} ratio  raw score ratio from calculateScore()
 * @returns {string}  e.g. "92.5" or "125.0"
 */
function scoreToDisplay(ratio) {
  return Math.min(ratio * 100, 150).toFixed(1);
}

/**
 * Weighted overall score for a set of goals.
 * Each goal contributes (score × weightage / 100).
 *
 * @param {Array<{
 *   uom_type: string,
 *   target_value: number,
 *   weightage: number,
 *   actual_value?: number,
 *   completion_date?: string,
 *   target_date?: string
 * }>} goals
 * @returns {number} weighted ratio (0 to 1+)
 */
function calculateOverallScore(goals) {
  if (!goals || goals.length === 0) return 0;

  return goals.reduce((sum, goal) => {
    const ratio = calculateScore(
      goal.uom_type,
      goal.target_value,
      goal.actual_value,
      goal.target_date,
      goal.completion_date
    );
    return sum + ratio * (Number(goal.weightage) / 100);
  }, 0);
}

/**
 * Enrich a goals array with computed score fields.
 * Adds: score_ratio, score_display, score_pct (number)
 *
 * @param {Array} goals
 * @param {Array} [achievements] - optional flat achievements array;
 *   if provided, each goal's actual is looked up from here.
 * @param {string} [quarter]     - filter achievements by quarter
 * @returns {Array} enriched goals
 */
function enrichGoalsWithScores(goals, achievements = [], quarter = null) {
  const achievementMap = {};
  for (const a of achievements) {
    const key = quarter ? `${a.goal_id}_${a.quarter}` : a.goal_id;
    achievementMap[key] = a;
  }

  return goals.map((g) => {
    const key = quarter ? `${g.id}_${quarter}` : g.id;
    const ach = achievementMap[key] || {};

    const ratio = calculateScore(
      g.uom_type,
      g.target_value,
      ach.actual_value ?? g.actual_value ?? null,
      g.target_date,
      ach.completion_date ?? g.completion_date ?? null
    );

    return {
      ...g,
      actual_value:    ach.actual_value    ?? g.actual_value    ?? null,
      completion_date: ach.completion_date ?? g.completion_date ?? null,
      goal_status:     ach.goal_status     ?? g.goal_status     ?? 'not_started',
      score_ratio:     ratio,
      score_display:   scoreToDisplay(ratio),
      score_pct:       Math.min(ratio * 100, 150),
    };
  });
}

module.exports = {
  calculateScore,
  scoreToDisplay,
  calculateOverallScore,
  enrichGoalsWithScores,
};
