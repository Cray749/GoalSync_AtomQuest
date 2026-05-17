import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/common/AppShell';
import GoalCard from '../../components/employee/GoalCard';
import GoalForm from '../../components/employee/GoalForm';
import ScoreGauge from '../../components/charts/ScoreGauge';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import { goalService } from '../../services/goalService';
import { cycleService } from '../../services/index.js';
import { useAuth } from '../../hooks/useAuth';
import { calculateScore, toDisplayPct, computeOverallScore } from '../../utils/scoreCalc';
import { getWindowLabel, getWindowColor, fmtPct } from '../../utils/formatters';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [goals, setGoals] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGoalForm, setShowGoalForm] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

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

  // Computed stats
  const approvedGoals = goals.filter((g) => g.status === 'approved').length;
  const submittedGoals = goals.filter((g) => g.status === 'submitted').length;
  const pendingCheckins = goals.filter((g) => {
    if (g.status !== 'approved') return false;
    if (!cycle?.active_quarter) return false;
    return !g.achievements?.some((a) => a.quarter === cycle.active_quarter);
  }).length;

  const scoredGoals = goals.map((g) => {
    const latest = g.achievements?.slice(-1)[0];
    const raw = latest
      ? calculateScore(g.uom_type, g.target_value, latest.actual_value, g.target_date, latest.completion_date)
      : null;
    return { ...g, score: raw };
  });
  const overallScore = computeOverallScore(scoredGoals);

  const canAddGoal = cycle?.is_goal_setting_open && goals.length < 8 &&
    !goals.some((g) => ['submitted', 'approved'].includes(g.status));

  const windowColor = getWindowColor(cycle?.active_window);

  const stats = [
    {
      label: 'Overall Score',
      value: goals.some((g) => g.achievements?.length > 0) ? fmtPct(overallScore) : '—',
      sub: 'Weighted avg across all goals',
      accent: '#2563eb',
    },
    {
      label: 'Total Goals',
      value: goals.length,
      sub: `${approvedGoals} approved · ${submittedGoals} pending`,
      accent: '#10b981',
    },
    {
      label: 'Goals Approved',
      value: approvedGoals,
      sub: `${goals.length > 0 ? Math.round((approvedGoals / goals.length) * 100) : 0}% of your goals`,
      accent: '#f59e0b',
    },
    {
      label: 'Pending Check-ins',
      value: pendingCheckins,
      sub: cycle?.active_quarter ? `For ${cycle.active_quarter}` : 'No window open',
      accent: pendingCheckins > 0 ? '#ef4444' : '#64748b',
    },
  ];

  if (loading) return <AppShell><PageLoader /></AppShell>;

  return (
    <AppShell>
      {/* Page header */}
      <div className="gs-page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            My Goals
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {cycle?.name || 'No active cycle'} · {user?.department}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Window status badge */}
          {cycle && (
            <span className={`gs-badge border text-xs font-medium px-3 py-1 ${windowColor}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse inline-block mr-1" />
              {getWindowLabel(cycle.active_window)}
            </span>
          )}
          {canAddGoal && (
            <button onClick={() => setShowGoalForm(true)} className="gs-btn">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Goal
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-stagger">
        {stats.map((s) => (
          <div key={s.label} className="gs-stat-card group">
            <p className="gs-section-title mb-2">{s.label}</p>
            <p
              className="text-3xl font-mono font-bold tracking-tight gs-number"
              style={{ color: s.accent }}
            >
              {s.value}
            </p>
            <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Score gauge + per-goal breakdown */}
      {goals.length > 0 && goals.some((g) => g.achievements?.length > 0) && (
        <div className="gs-card p-5 mb-8 flex items-center gap-8 flex-wrap">
          <ScoreGauge
            score={overallScore > 0 ? overallScore : null}
            size={140}
            label="Overall Score"
            subLabel={`${approvedGoals} approved goal${approvedGoals !== 1 ? 's' : ''}`}
          />
          <div className="flex-1 min-w-[240px]">
            <p className="gs-section-title mb-3">PER-GOAL SCORE BREAKDOWN</p>
            <div className="space-y-2">
              {scoredGoals.filter((g) => g.score !== null).map((g) => {
                const pct = g.score !== null ? Math.min(g.score * 100, 150) : null;
                const color = pct !== null
                  ? pct >= 100 ? '#10b981' : pct >= 80 ? '#3b82f6' : pct >= 60 ? '#f59e0b' : '#ef4444'
                  : '#475569';
                return (
                  <div key={g.id} className="flex items-center gap-3">
                    <p className="text-xs text-slate-400 truncate w-40 shrink-0">{g.title}</p>
                    <div className="flex-1 h-2 bg-[#0f2040] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min((pct / 150) * 100, 100)}%`,
                          backgroundColor: color,
                          boxShadow: `0 0 6px ${color}60`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono w-14 text-right shrink-0" style={{ color }}>
                      {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                    </span>
                    <span className="text-xs font-mono text-slate-600 w-10 shrink-0">
                      {parseFloat(g.weightage)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* No cycle notice */}
      {!cycle && (
        <div className="gs-card p-8 text-center">
          <p className="text-2xl mb-2">🗓️</p>
          <p className="text-sm font-medium text-slate-300">No active goal cycle</p>
          <p className="text-xs text-slate-500 mt-1">Contact your HR admin to set up the FY cycle.</p>
        </div>
      )}

      {/* Goals grid */}
      {goals.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="gs-section-title">My Goals ({goals.length}/8)</h2>
            <button
              onClick={() => navigate('/employee/goals')}
              className="text-xs text-[#3b82f6] hover:text-blue-300 flex items-center gap-1"
            >
              View full sheet
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-stagger">
            {scoredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onClick={() => navigate('/employee/goals')}
              />
            ))}
          </div>
        </div>
      ) : cycle?.is_goal_setting_open ? (
        <div className="gs-card p-12 text-center border-dashed border-[#1e3a70]">
          <div className="w-16 h-16 rounded-full bg-[#0f2040] border border-[#162d58] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-300 mb-1">No goals yet</p>
          <p className="text-xs text-slate-500 mb-4">The goal setting window is open. Add up to 8 goals.</p>
          <button onClick={() => setShowGoalForm(true)} className="gs-btn">
            Add Your First Goal
          </button>
        </div>
      ) : (
        <div className="gs-card p-8 text-center">
          <p className="text-sm text-slate-400">No goals for this cycle.</p>
        </div>
      )}

      {/* Goal form modal */}
      <GoalForm
        isOpen={showGoalForm}
        onClose={() => setShowGoalForm(false)}
        onSuccess={fetchAll}
        cycleId={cycle?.id}
      />
    </AppShell>
  );
}
