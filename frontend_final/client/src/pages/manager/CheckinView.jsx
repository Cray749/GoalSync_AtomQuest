import { useState, useEffect } from 'react';
import AppShell from '../../components/common/AppShell';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/common/Modal';
import ProgressBar from '../../components/common/ProgressBar';
import { managerService } from '../../services/index.js';
import { calculateScore, toDisplayPct, getScoreClass } from '../../utils/scoreCalc';
import { fmtDate, UOM_ICONS, fmtRelative } from '../../utils/formatters';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function CheckinView() {
  const toast = useToast();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [employeeGoals, setEmployeeGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [checkinModal, setCheckinModal] = useState(null); // { goal }
  const [checkinComment, setCheckinComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchTeam(); }, []);

  useEffect(() => {
    if (selectedEmployee) fetchEmployeeGoals(selectedEmployee.id);
  }, [selectedEmployee, selectedQuarter]);

  async function fetchTeam() {
    setLoading(true);
    try {
      const res = await managerService.getTeam();
      const members = res.data.data || [];
      setTeam(members);
      if (members.length > 0) setSelectedEmployee(members[0]);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmployeeGoals(employeeId) {
    setGoalsLoading(true);
    try {
      const res = await managerService.getEmployeeGoals(employeeId);
      const goalsData = res.data.data?.goals || res.data.data || [];
      const goalsArr = Array.isArray(goalsData) ? goalsData : [];
      setEmployeeGoals(goalsArr.filter((g) => g.status === 'approved'));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setGoalsLoading(false);
    }
  }

  async function submitCheckin() {
    if (!checkinComment.trim() || checkinComment.trim().length < 5) {
      toast('Comment must be at least 5 characters', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await managerService.submitCheckin({
        goal_id: checkinModal.goal.id,
        quarter: selectedQuarter,
        comment: checkinComment.trim(),
      });
      toast('Check-in comment submitted ✅', 'success');
      setCheckinModal(null);
      setCheckinComment('');
      fetchEmployeeGoals(selectedEmployee.id);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <AppShell><PageLoader /></AppShell>;

  return (
    <AppShell>
      <div className="gs-page-header">
        <h1 className="text-2xl font-bold text-slate-100">Check-in View</h1>
        <p className="text-sm text-slate-400 mt-1">Review and comment on your team's quarterly progress</p>
      </div>

      <div className="flex gap-6">
        {/* Employee sidebar */}
        <div className="w-52 shrink-0">
          <p className="gs-section-title mb-2">Team Members</p>
          <div className="space-y-1">
            {team.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedEmployee(m)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-gs text-left transition-all ${
                  selectedEmployee?.id === m.id
                    ? 'bg-[#2563eb]/15 border border-[#2563eb]/25 text-[#60a5fa]'
                    : 'text-slate-400 hover:bg-[#0f2040] hover:text-slate-300 border border-transparent'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[#162d58] flex items-center justify-center text-xs font-bold shrink-0">
                  {m.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{m.name.split(' ')[0]}</p>
                  <p className="text-[10px] text-slate-600 truncate">{m.department}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Quarter tabs */}
          <div className="flex gap-2 mb-5">
            {QUARTERS.map((q) => (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`px-4 py-1.5 rounded-gs text-sm font-medium border transition-all ${
                  selectedQuarter === q
                    ? 'bg-[#2563eb] border-[#2563eb] text-white'
                    : 'bg-transparent border-[#162d58] text-slate-400 hover:border-[#1e3a70]'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Goals list */}
          {goalsLoading ? (
            <PageLoader />
          ) : employeeGoals.length === 0 ? (
            <div className="gs-card p-8 text-center">
              <p className="text-sm text-slate-400">No approved goals for {selectedEmployee?.name}.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {employeeGoals.map((goal) => {
                const achievement = goal.achievements?.find((a) => a.quarter === selectedQuarter);
                const checkins = goal.checkins?.filter((c) => c.quarter === selectedQuarter && c.quarter !== 'REWORK') || [];
                const rawScore = achievement
                  ? calculateScore(goal.uom_type, goal.target_value, achievement.actual_value, goal.target_date, achievement.completion_date)
                  : null;
                const displayScore = rawScore !== null ? toDisplayPct(rawScore) : null;

                return (
                  <div key={goal.id} className="gs-card p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-slate-500">
                            {UOM_ICONS[goal.uom_type]} {goal.uom_type?.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-600">· {goal.thrust_area_name || '—'}</span>
                          <span className="text-xs font-mono font-semibold text-[#60a5fa] ml-2">
                            {parseFloat(goal.weightage)}%
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-100">{goal.title}</h3>
                      </div>
                      <button
                        onClick={() => { setCheckinModal({ goal }); setCheckinComment(''); }}
                        className="gs-btn-ghost text-xs py-1 px-2.5 shrink-0"
                      >
                        + Comment
                      </button>
                    </div>

                    {/* Achievement row */}
                    <div className="grid grid-cols-3 gap-4 mb-3 text-xs">
                      <div>
                        <p className="text-slate-500 mb-0.5">Planned</p>
                        <p className="font-mono text-slate-300">
                          {goal.target_value !== null ? Number(goal.target_value).toLocaleString('en-IN') : fmtDate(goal.target_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-0.5">Actual</p>
                        <p className={`font-mono font-medium ${achievement ? 'text-slate-100' : 'text-slate-600'}`}>
                          {achievement?.actual_value !== null && achievement?.actual_value !== undefined
                            ? Number(achievement.actual_value).toLocaleString('en-IN')
                            : achievement?.completion_date
                            ? fmtDate(achievement.completion_date)
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-0.5">Status</p>
                        <p className={`font-medium capitalize ${
                          achievement?.goal_status === 'completed' ? 'text-emerald-400'
                          : achievement?.goal_status === 'on_track' ? 'text-blue-400'
                          : achievement?.goal_status === 'missed' ? 'text-red-400'
                          : 'text-slate-500'
                        }`}>
                          {achievement?.goal_status?.replace('_', ' ') || 'Not logged'}
                        </p>
                      </div>
                    </div>

                    {/* Score bar */}
                    {displayScore !== null && (
                      <ProgressBar value={displayScore} height={5} className="mb-3" />
                    )}

                    {/* Manager comments */}
                    {checkins.length > 0 && (
                      <div className="space-y-2 mt-3 pt-3 border-t border-[#0f2040]">
                        <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Your Comments</p>
                        {checkins.map((c) => (
                          <div key={c.id} className="px-3 py-2 bg-[#0a1628] border border-[#162d58] rounded text-xs">
                            <p className="text-slate-300 leading-relaxed">{c.comment}</p>
                            <p className="text-slate-600 mt-1 font-mono">{fmtRelative(c.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Check-in Modal */}
      <Modal
        isOpen={!!checkinModal}
        onClose={() => setCheckinModal(null)}
        title={`Add ${selectedQuarter} Check-in Comment`}
        size="sm"
        footer={
          <>
            <button onClick={() => setCheckinModal(null)} className="gs-btn-ghost">Cancel</button>
            <button onClick={submitCheckin} disabled={submitting} className="gs-btn">
              {submitting ? 'Saving…' : 'Submit Comment'}
            </button>
          </>
        }
      >
        {checkinModal && (
          <div className="space-y-3">
            <div className="px-3 py-2 bg-[#0a1628] border border-[#162d58] rounded text-xs text-slate-300">
              {checkinModal.goal.title}
            </div>
            <div>
              <label className="gs-label">Your Feedback</label>
              <textarea
                className="gs-textarea"
                rows={4}
                value={checkinComment}
                onChange={(e) => setCheckinComment(e.target.value)}
                placeholder="Add your observation or guidance for this quarter…"
                autoFocus
              />
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
