import { useState, useEffect } from 'react';
import AppShell from '../../components/common/AppShell';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import { goalService } from '../../services/goalService';
import { achievementService, cycleService } from '../../services/index.js';
import { calculateScore, toDisplayPct, getScoreClass, getScoreLabel } from '../../utils/scoreCalc';
import { fmtDate, UOM_LABELS, UOM_ICONS, getWindowLabel, getWindowColor } from '../../utils/formatters';
import ProgressBar from '../../components/common/ProgressBar';
import StatusBadge from '../../components/common/StatusBadge';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const GOAL_STATUSES = ['not_started', 'on_track', 'completed', 'at_risk'];
const STATUS_LABELS = { not_started: 'Not Started', on_track: 'On Track', completed: 'Completed', at_risk: 'At Risk' };

export default function CheckinPage() {
  const toast = useToast();
  const [goals, setGoals] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedQuarter, setSelectedQuarter] = useState(null);
  const [actuals, setActuals] = useState({}); // { [goalId]: { actual_value, goal_status, completion_date } }
  const [saving, setSaving] = useState({});   // { [goalId]: bool }
  const [saved, setSaved] = useState({});     // { [goalId]: bool }

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [goalsRes, cycleRes] = await Promise.all([
        goalService.getMyGoals(),
        cycleService.getActive(),
      ]);
      const goalsPayload = goalsRes.data.data;
      const allGoals = goalsPayload?.goals ?? (Array.isArray(goalsPayload) ? goalsPayload : []);
      const fetchedGoals = allGoals.filter((g) => g.status === 'approved');
      setGoals(fetchedGoals);
      const fetchedCycle = cycleRes.data.data;
      setCycle(fetchedCycle);

      // Auto-select active quarter
      const activeQ = fetchedCycle?.active_quarter;
      setSelectedQuarter(activeQ || 'Q1');

      // Pre-populate actuals from existing achievements
      const initial = {};
      for (const g of fetchedGoals) {
        const existing = g.achievements?.find((a) => a.quarter === (activeQ || 'Q1'));
        initial[g.id] = {
          actual_value: existing?.actual_value ?? '',
          goal_status: existing?.goal_status ?? 'on_track',
          completion_date: existing?.completion_date ? existing.completion_date.split('T')[0] : '',
          existing_id: existing?.id,
        };
      }
      setActuals(initial);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleQuarterChange(q) {
    setSelectedQuarter(q);
    // Re-populate actuals for newly selected quarter
    const updated = {};
    for (const g of goals) {
      const existing = g.achievements?.find((a) => a.quarter === q);
      updated[g.id] = {
        actual_value: existing?.actual_value ?? '',
        goal_status: existing?.goal_status ?? 'on_track',
        completion_date: existing?.completion_date ? existing.completion_date.split('T')[0] : '',
        existing_id: existing?.id,
      };
    }
    setActuals(updated);
    setSaved({});
  }

  function setField(goalId, field, value) {
    setActuals((prev) => ({
      ...prev,
      [goalId]: { ...prev[goalId], [field]: value },
    }));
    setSaved((prev) => ({ ...prev, [goalId]: false }));
  }

  async function saveGoal(goal) {
    const data = actuals[goal.id] || {};
    const needsValue = ['min', 'max'].includes(goal.uom_type);
    const needsDate = goal.uom_type === 'timeline';

    if (needsValue && (data.actual_value === '' || data.actual_value === null)) {
      toast('Please enter actual value before saving', 'error');
      return;
    }

    setSaving((prev) => ({ ...prev, [goal.id]: true }));
    try {
      const payload = {
        goal_id: goal.id,
        quarter: selectedQuarter,
        actual_value: needsValue || goal.uom_type === 'zero'
          ? parseFloat(data.actual_value)
          : null,
        goal_status: data.goal_status,
        completion_date: needsDate ? (data.completion_date || null) : null,
      };

      if (data.existing_id) {
        await achievementService.updateAchievement(data.existing_id, payload);
      } else {
        const res = await achievementService.submitAchievement(payload);
        // Store the returned ID for future updates
        setActuals((prev) => ({
          ...prev,
          [goal.id]: { ...prev[goal.id], existing_id: res.data.data?.id },
        }));
      }

      setSaved((prev) => ({ ...prev, [goal.id]: true }));
      toast(`${goal.title.substring(0, 30)}… saved`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving((prev) => ({ ...prev, [goal.id]: false }));
    }
  }

  async function saveAll() {
    let success = 0;
    for (const g of goals) {
      if (['min', 'max', 'zero'].includes(g.uom_type) && actuals[g.id]?.actual_value === '') continue;
      await saveGoal(g);
      success++;
    }
    if (success > 0) toast(`${success} goals saved for ${selectedQuarter}`, 'success');
  }

  const isWindowOpen = cycle?.is_checkin_open;
  const isActiveQuarter = selectedQuarter === cycle?.active_quarter;

  if (loading) return <AppShell><PageLoader /></AppShell>;

  return (
    <AppShell>
      {/* Header */}
      <div className="gs-page-header">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Quarterly Check-ins</h1>
            <p className="text-sm text-slate-400 mt-1">{cycle?.name || 'No active cycle'}</p>
          </div>
          {isWindowOpen && (
            <div className="flex items-center gap-3">
              <span className={`gs-badge border text-xs px-2.5 py-1 ${getWindowColor(cycle?.active_window)}`}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse inline-block mr-1" />
                {getWindowLabel(cycle?.active_window)}
              </span>
              <button onClick={saveAll} className="gs-btn">
                Save All {selectedQuarter}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quarter selector */}
      <div className="flex gap-2 mb-6">
        {QUARTERS.map((q) => {
          const hasEntries = goals.some((g) => g.achievements?.some((a) => a.quarter === q));
          const isActive = q === cycle?.active_quarter;
          return (
            <button
              key={q}
              onClick={() => handleQuarterChange(q)}
              className={`flex items-center gap-2 px-4 py-2 rounded-gs text-sm font-medium border transition-all ${
                selectedQuarter === q
                  ? 'bg-[#2563eb] border-[#2563eb] text-white shadow-glow-sm'
                  : 'bg-transparent border-[#162d58] text-slate-400 hover:border-[#1e3a70] hover:text-slate-300'
              }`}
            >
              {q}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {hasEntries && !isActive && (
                <span className="text-[10px] text-emerald-400">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Window closed notice */}
      {!isWindowOpen && (
        <div className="gs-card p-4 mb-6 border-amber-500/20 bg-amber-900/10 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-300">Check-in window is currently closed</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              {selectedQuarter} data is read-only. Wait for the window to open to update.
            </p>
          </div>
        </div>
      )}

      {/* No approved goals */}
      {goals.length === 0 && (
        <div className="gs-card p-10 text-center">
          <p className="text-slate-400 text-sm">No approved goals found.</p>
          <p className="text-xs text-slate-500 mt-1">Goals must be approved by your manager before you can log check-ins.</p>
        </div>
      )}

      {/* Goals list */}
      <div className="space-y-4">
        {goals.map((goal) => {
          const data = actuals[goal.id] || {};
          const needsValue = ['min', 'max'].includes(goal.uom_type);
          const needsDate = goal.uom_type === 'timeline';
          const isZero = goal.uom_type === 'zero';

          // Live score
          const rawScore = calculateScore(
            goal.uom_type,
            goal.target_value,
            data.actual_value !== '' && data.actual_value !== undefined ? parseFloat(data.actual_value) : null,
            goal.target_date,
            data.completion_date || null
          );
          const displayScore = (data.actual_value !== '' || data.completion_date)
            ? toDisplayPct(rawScore)
            : null;

          const isSaving = saving[goal.id];
          const isSaved = saved[goal.id];

          return (
            <div key={goal.id} className="gs-card p-5">
              {/* Goal header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">
                      {UOM_ICONS[goal.uom_type]} {goal.uom_type.toUpperCase()}
                    </span>
                    {goal.thrust_area_name && (
                      <span className="text-xs text-slate-600">· {goal.thrust_area_name}</span>
                    )}
                    <span className="text-xs font-mono font-semibold text-[#60a5fa] ml-auto">
                      {parseFloat(goal.weightage)}% wt
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100">{goal.title}</h3>
                </div>

                {/* Score badge */}
                {displayScore !== null && (
                  <div className={`shrink-0 text-right ${getScoreClass(displayScore)}`}>
                    <p className="text-2xl font-mono font-bold">{displayScore.toFixed(1)}%</p>
                    <p className="text-xs opacity-70">{getScoreLabel(displayScore)}</p>
                  </div>
                )}
              </div>

              {/* Target info row */}
              <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 pb-4 border-b border-[#0f2040]">
                <span>
                  Planned: <span className="font-mono text-slate-300">
                    {goal.target_value !== null ? Number(goal.target_value).toLocaleString('en-IN') : fmtDate(goal.target_date)}
                  </span>
                </span>
                <span>Weight: <span className="font-mono text-slate-300">{parseFloat(goal.weightage)}%</span></span>
                {goal.target_date && (
                  <span>Due: <span className="text-slate-300">{fmtDate(goal.target_date)}</span></span>
                )}
              </div>

              {/* Input row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* Actual value */}
                {(needsValue || isZero) && (
                  <div>
                    <label className="gs-label">
                      {isZero ? 'Incidents / Defects' : 'Actual Value'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="gs-input font-mono text-base"
                      value={data.actual_value ?? ''}
                      onChange={(e) => setField(goal.id, 'actual_value', e.target.value)}
                      placeholder={isZero ? '0 = 100% score' : 'Enter actual'}
                      disabled={!isWindowOpen || !isActiveQuarter}
                    />
                  </div>
                )}

                {/* Completion date */}
                {needsDate && (
                  <div>
                    <label className="gs-label">Completion Date</label>
                    <input
                      type="date"
                      className="gs-input font-mono"
                      value={data.completion_date || ''}
                      onChange={(e) => setField(goal.id, 'completion_date', e.target.value)}
                      disabled={!isWindowOpen || !isActiveQuarter}
                    />
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="gs-label">Status</label>
                  <select
                    className="gs-select"
                    value={data.goal_status || 'on_track'}
                    onChange={(e) => setField(goal.id, 'goal_status', e.target.value)}
                    disabled={!isWindowOpen || !isActiveQuarter}
                  >
                    {GOAL_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                {/* Save button */}
                {isWindowOpen && isActiveQuarter && (
                  <div className="flex justify-end md:justify-start">
                    <button
                      onClick={() => saveGoal(goal)}
                      disabled={isSaving}
                      className={isSaved ? 'gs-btn-success' : 'gs-btn'}
                    >
                      {isSaving ? 'Saving…' : isSaved ? '✓ Saved' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {/* Score bar */}
              {displayScore !== null && (
                <div className="mt-4 pt-4 border-t border-[#0f2040]">
                  <ProgressBar value={displayScore} height={6} />
                </div>
              )}

              {/* Manager check-in comments for this quarter */}
              {(() => {
                const qCheckins = goal.checkins?.filter(
                  (c) => c.quarter === selectedQuarter
                ) || [];
                if (qCheckins.length === 0) return null;
                return (
                  <div className="mt-4 pt-4 border-t border-[#0f2040] space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Manager Comments
                    </p>
                    {qCheckins.map((c) => (
                      <div key={c.id} className="px-3 py-2 bg-[#0a1628] border border-[#162d58] rounded text-xs">
                        <p className="text-[#60a5fa] font-medium mb-0.5">{c.manager_name}</p>
                        <p className="text-slate-300 leading-relaxed">{c.comment}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
