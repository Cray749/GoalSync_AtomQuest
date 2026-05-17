/**
 * GoalSync Score Calculator — Client Mirror
 * Mirrors server/src/services/score.service.js exactly.
 * Used for real-time score display as employee types actuals.
 */

export function calculateScore(uomType, target, actual, targetDate, completionDate) {
  switch (uomType) {
    case 'min': {
      if (!target || target === 0) return 0;
      if (actual === null || actual === undefined || actual === '') return 0;
      return Math.max(0, Number(actual) / Number(target));
    }
    case 'max': {
      if (actual === null || actual === undefined || actual === '') return 0;
      if (Number(actual) === 0) return 1;
      if (!target || target === 0) return 0;
      return Math.max(0, Number(target) / Number(actual));
    }
    // FIX 8A: Flat 0.5 for any late completion (matches server)
    case 'timeline': {
      if (!completionDate) return 0;
      if (!targetDate) return 0;
      const deadlineMs  = new Date(targetDate).getTime();
      const completedMs = new Date(completionDate).getTime();
      if (isNaN(deadlineMs) || isNaN(completedMs)) return 0;
      return completedMs <= deadlineMs ? 1 : 0.5;
    }
    case 'zero': {
      if (actual === null || actual === undefined || actual === '') return 0;
      return Number(actual) === 0 ? 1 : 0;
    }
    default:
      return 0;
  }
}

export function toDisplayPct(score) {
  if (score === null || score === undefined) return null;
  return Math.min(score * 100, 150);
}

export function computeOverallScore(goals) {
  const total = goals.reduce((sum, g) => {
    if (g.score === null || g.score === undefined) return sum;
    return sum + g.score * (parseFloat(g.weightage) / 100);
  }, 0);
  return Math.min(total * 100, 150);
}

export function getScoreLabel(pct) {
  if (pct === null || pct === undefined) return 'Not Started';
  if (pct >= 100) return 'Exceeds Target';
  if (pct >= 80) return 'On Track';
  if (pct >= 60) return 'Below Target';
  return 'Needs Attention';
}

export function getScoreColor(pct) {
  if (pct === null || pct === undefined) return '#64748b';
  if (pct >= 100) return '#10b981';
  if (pct >= 80) return '#3b82f6';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}

export function getScoreClass(pct) {
  if (pct === null || pct === undefined) return 'text-slate-500';
  if (pct >= 100) return 'text-emerald-400';
  if (pct >= 80) return 'text-blue-400';
  if (pct >= 60) return 'text-amber-400';
  return 'text-red-400';
}

// FIX 8B: Aliases for Session 6 analytics components
export const scoreToDisplay        = toDisplayPct;
export const calculateOverallScore = computeOverallScore;
