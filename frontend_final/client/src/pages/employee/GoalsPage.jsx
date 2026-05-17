import { useState, useEffect } from 'react';
import AppShell from '../../components/common/AppShell';
import GoalCard from '../../components/employee/GoalCard';
import GoalForm from '../../components/employee/GoalForm';
import WeightageGauge from '../../components/employee/WeightageGauge';
import StatusBadge from '../../components/common/StatusBadge';
import ProgressBar from '../../components/common/ProgressBar';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import { goalService } from '../../services/goalService';
import { cycleService } from '../../services/index.js';
import { calculateScore, toDisplayPct, computeOverallScore } from '../../utils/scoreCalc';
import { fmtDate, UOM_LABELS, UOM_ICONS, getTotalWeightage, getWindowLabel, getWindowColor } from '../../utils/formatters';

export default function GoalsPage() {
  const toast = useToast();
  const [goals, setGoals] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [view, setView] = useState('cards'); // 'cards' | 'table'

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [goalsRes, cycleRes] = await Promise.all([
        goalService.getMyGoals(),
        cycleService.getActive(),
      ]);
      setGoals(goalsRes.data.data?.goals || []);
      setCycle(cycleRes.data.data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(goal) {
    try {
      await goalService.deleteGoal(goal.id);
      toast('Goal deleted', 'success');
      fetchAll();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeleteConfirm(null);
    }
  }

  async function handleSubmitAll() {
    setSubmitting(true);
    try {
      await goalService.submitGoals(cycle?.id);
      toast('Goals submitted for approval! Your manager has been notified.', 'success');
      fetchAll();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const totalWeightage = getTotalWeightage(goals);
  const allDraft = goals.length > 0 && goals.every((g) => ['draft', 'rework'].includes(g.status));
  const canSubmit = allDraft && Math.abs(totalWeightage - 100) < 0.01 && cycle?.is_goal_setting_open;
  const canAddGoal = cycle?.is_goal_setting_open && goals.length < 8 &&
    !goals.some((g) => ['submitted', 'approved'].includes(g.status));

  const scoredGoals = goals.map((g) => {
    const latest = g.achievements?.slice(-1)[0];
    const raw = latest ? calculateScore(g.uom_type, g.target_value, latest.actual_value, g.target_date, latest.completion_date) : null;
    return { ...g, score: raw, displayScore: raw !== null ? toDisplayPct(raw) : null };
  });

  if (loading) return <AppShell><PageLoader /></AppShell>;

  return (
    <AppShell>
      {/* Header */}
      <div className="gs-page-header">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Goal Sheet</h1>
            <p className="text-sm text-slate-400 mt-1">{cycle?.name || 'No active cycle'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {cycle && (
              <span className={`gs-badge border text-xs px-2.5 py-1 ${getWindowColor(cycle.active_window)}`}>
                {getWindowLabel(cycle.active_window)}
              </span>
            )}
            {/* View toggle */}
            <div className="flex items-center bg-[#0a1628] border border-[#162d58] rounded-gs p-1">
              {['cards', 'table'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all capitalize ${
                    view === v ? 'bg-[#162d58] text-slate-200' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            {canAddGoal && (
              <button onClick={() => { setEditGoal(null); setShowForm(true); }} className="gs-btn">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Goal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Weightage Gauge */}
      {goals.length > 0 && <div className="mb-6"><WeightageGauge goals={goals} /></div>}

      {/* Goals: Cards View */}
      {view === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6 animate-stagger">
          {scoredGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={(g) => { setEditGoal(g); setShowForm(true); }}
              onDelete={(g) => setDeleteConfirm(g)}
            />
          ))}
          {goals.length === 0 && (
            <div className="col-span-3 gs-card p-10 text-center border-dashed border-[#1e3a70]">
              <p className="text-slate-400 text-sm">No goals added yet.</p>
              {canAddGoal && (
                <button onClick={() => setShowForm(true)} className="gs-btn mt-4">Add First Goal</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Goals: Table View */}
      {view === 'table' && goals.length > 0 && (
        <div className="gs-card mb-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="gs-table">
              <thead>
                <tr>
                  <th>Goal</th>
                  <th>Thrust Area</th>
                  <th>UoM</th>
                  <th>Target</th>
                  <th className="text-center">Weight</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {scoredGoals.map((g) => (
                  <tr key={g.id}>
                    <td className="max-w-[200px]">
                      <p className="font-medium text-slate-200 truncate">{g.title}</p>
                      {g.is_shared && <span className="text-[10px] text-violet-400">🔗 Shared</span>}
                      {g.rework_comment && (
                        <p className="text-[10px] text-red-400 truncate mt-0.5">↩ {g.rework_comment}</p>
                      )}
                    </td>
                    <td className="text-slate-400 text-xs">{g.thrust_area_name || '—'}</td>
                    <td className="text-xs font-mono text-slate-400">
                      {UOM_ICONS[g.uom_type]} {g.uom_type.toUpperCase()}
                    </td>
                    <td className="text-xs font-mono">
                      {g.target_value !== null ? Number(g.target_value).toLocaleString('en-IN') : fmtDate(g.target_date)}
                    </td>
                    <td className="text-center">
                      <span className="text-sm font-mono font-semibold text-[#60a5fa]">
                        {parseFloat(g.weightage)}%
                      </span>
                    </td>
                    <td><StatusBadge status={g.status} /></td>
                    <td className="w-24">
                      {g.displayScore !== null ? (
                        <ProgressBar value={g.displayScore} showLabel height={4} />
                      ) : <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td>
                      {['draft', 'rework'].includes(g.status) && !g.is_locked && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditGoal(g); setShowForm(true); }}
                            className="p-1 text-slate-500 hover:text-blue-400 rounded"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 15H9v-2z" />
                            </svg>
                          </button>
                          {g.status === 'draft' && (
                            <button
                              onClick={() => setDeleteConfirm(g)}
                              className="p-1 text-slate-500 hover:text-red-400 rounded"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer row: total weightage */}
              <tfoot>
                <tr className="border-t-2 border-[#162d58]">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Weightage
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-mono font-bold ${
                      Math.abs(totalWeightage - 100) < 0.01 ? 'text-emerald-400'
                      : totalWeightage > 100 ? 'text-red-400'
                      : 'text-amber-400'
                    }`}>
                      {totalWeightage.toFixed(1)}%
                    </span>
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Submit bar */}
      {goals.length > 0 && goals.some((g) => ['draft', 'rework'].includes(g.status)) && (
        <div className="gs-card p-4 flex items-center justify-between gap-4 border-[#1e3a70]">
          <div>
            <p className="text-sm font-medium text-slate-200">Ready to submit?</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {Math.abs(totalWeightage - 100) > 0.01
                ? `Weightage must total 100% (currently ${totalWeightage.toFixed(1)}%)`
                : !cycle?.is_goal_setting_open
                ? 'Goal setting window is currently closed'
                : 'All goals will be sent to your manager for approval.'}
            </p>
          </div>
          <button
            onClick={handleSubmitAll}
            disabled={!canSubmit || submitting}
            className="gs-btn shrink-0"
          >
            {submitting ? 'Submitting…' : 'Submit Goals →'}
          </button>
        </div>
      )}

      {/* Goal Form Modal */}
      <GoalForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditGoal(null); }}
        onSuccess={fetchAll}
        editGoal={editGoal}
        cycleId={cycle?.id}
      />

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(6,13,31,0.85)' }}>
          <div className="gs-card p-6 max-w-sm w-full shadow-glow-lg animate-slide-up">
            <h3 className="text-base font-semibold text-slate-100 mb-2">Delete Goal?</h3>
            <p className="text-sm text-slate-400 mb-5">
              "<span className="text-slate-300">{deleteConfirm.title}</span>" will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="gs-btn-ghost">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="gs-btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
