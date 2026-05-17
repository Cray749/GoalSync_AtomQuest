import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

// ── Date Formatters ───────────────────────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? parseISO(d) : d;
  return isValid(date) ? format(date, 'dd MMM yyyy') : '—';
}

export function fmtDateShort(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? parseISO(d) : d;
  return isValid(date) ? format(date, 'dd MMM') : '—';
}

export function fmtDateTime(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? parseISO(d) : d;
  return isValid(date) ? format(date, 'dd MMM yyyy, h:mm a') : '—';
}

export function fmtRelative(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? parseISO(d) : d;
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : '—';
}

// ── Number Formatters ─────────────────────────────────────────────────────────
export function fmtNumber(n, decimals = 0) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtCurrency(n) {
  if (n === null || n === undefined) return '—';
  return `₹${fmtNumber(n)}`;
}

export function fmtPct(n, decimals = 1) {
  if (n === null || n === undefined) return '—';
  return `${Number(n).toFixed(decimals)}%`;
}

// ── UoM Labels ────────────────────────────────────────────────────────────────
export const UOM_LABELS = {
  min: 'Higher is Better',
  max: 'Lower is Better',
  timeline: 'Date-Based',
  zero: 'Zero = Success',
};

export const UOM_ICONS = {
  min: '↑',
  max: '↓',
  timeline: '📅',
  zero: '✓',
};

// ── Status helpers ────────────────────────────────────────────────────────────
export const STATUS_CONFIG = {
  draft:      { label: 'Draft',      color: 'text-slate-400', bg: 'bg-slate-800/60',     border: 'border-slate-600/40' },
  submitted:  { label: 'Submitted',  color: 'text-amber-400', bg: 'bg-amber-900/20',     border: 'border-amber-500/30' },
  approved:   { label: 'Approved',   color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-500/30' },
  rework:     { label: 'Rework',     color: 'text-red-400',   bg: 'bg-red-900/20',       border: 'border-red-500/30' },
  not_started:{ label: 'Not Started',color: 'text-slate-500', bg: 'bg-slate-800/40',     border: 'border-slate-600/30' },
  on_track:   { label: 'On Track',   color: 'text-blue-400',  bg: 'bg-blue-900/20',      border: 'border-blue-500/30' },
  completed:  { label: 'Completed',  color: 'text-emerald-400',bg: 'bg-emerald-900/20',  border: 'border-emerald-500/30' },
  missed:     { label: 'Missed',     color: 'text-red-400',   bg: 'bg-red-900/20',       border: 'border-red-500/30' },
};

// ── Cycle window helpers ──────────────────────────────────────────────────────
export function getWindowLabel(window) {
  const map = {
    phase1: 'Goal Setting Open',
    q1: 'Q1 Check-in Open',
    q2: 'Q2 Check-in Open',
    q3: 'Q3 Check-in Open',
    q4: 'Q4 Check-in Open',
  };
  return map[window] || 'Window Closed';
}

export function getWindowColor(window) {
  if (!window) return 'text-slate-500 bg-slate-800/40 border-slate-600/30';
  if (window === 'phase1') return 'text-blue-400 bg-blue-900/20 border-blue-500/30';
  return 'text-emerald-400 bg-emerald-900/20 border-emerald-500/30';
}

// ── Download blob helper ──────────────────────────────────────────────────────
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Weightage helpers ─────────────────────────────────────────────────────────
export function getTotalWeightage(goals) {
  return goals.reduce((sum, g) => sum + parseFloat(g.weightage || 0), 0);
}

export function getWeightageStatus(total) {
  if (Math.abs(total - 100) < 0.01) return 'perfect';
  if (total > 100) return 'over';
  return 'under';
}
