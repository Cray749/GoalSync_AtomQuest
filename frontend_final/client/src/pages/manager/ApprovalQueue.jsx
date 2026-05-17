import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../../components/common/AppShell';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { managerService } from '../../services/index.js';
import { fmtDate, UOM_LABELS, UOM_ICONS } from '../../utils/formatters';

export default function ApprovalQueue() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const focusEmployee = searchParams.get('employee');

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(focusEmployee || null);
  const [inlineEdits, setInlineEdits] = useState({});    // { [goalId]: { target_value, weightage } }
  const [processing, setProcessing] = useState({});      // { [goalId]: 'approving'|'reworking' }
  const [approvingAll, setApprovingAll] = useState(null); // employeeId
  const [reworkModal, setReworkModal] = useState(null);   // { goalId, title }
  const [reworkComment, setReworkComment] = useState('');

  useEffect(() => { fetchQueue(); }, []);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await managerService.getApprovalQueue();
      setQueue(res.data.data || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function setInlineField(goalId, field, value) {
    setInlineEdits((prev) => ({
      ...prev,
      [goalId]: { ...(prev[goalId] || {}), [field]: value },
    }));
  }

  async function saveInlineEdit(goalId) {
    const edits = inlineEdits[goalId];
    if (!edits || Object.keys(edits).length === 0) return;
    try {
      await managerService.inlineEditGoal(goalId, edits);
      toast('Goal updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleApprove(goalId, employeeId) {
    setProcessing((p) => ({ ...p, [goalId]: 'approving' }));
    try {
      // Save any pending inline edits first
      if (inlineEdits[goalId]) await saveInlineEdit(goalId);
      await managerService.approveGoal(goalId);
      toast('Goal approved ✅', 'success');
      fetchQueue();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setProcessing((p) => ({ ...p, [goalId]: null }));
    }
  }

  async function handleRework() {
    if (!reworkComment.trim() || reworkComment.trim().length < 10) {
      toast('Comment must be at least 10 characters', 'error');
      return;
    }
    const { goalId } = reworkModal;
    setProcessing((p) => ({ ...p, [goalId]: 'reworking' }));
    try {
      await managerService.returnForRework(goalId, reworkComment.trim());
      toast('Goal returned for rework 🔄', 'info');
      setReworkModal(null);
      setReworkComment('');
      fetchQueue();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setProcessing((p) => ({ ...p, [goalId]: null }));
    }
  }

  async function handleApproveAll(employee) {
    setApprovingAll(employee.employee_id);
    try {
      const res = await managerService.approveAllGoals(employee.employee_id, employee.goals?.[0]?.cycle_id);
      toast(`${res.data.data.approved.length} goals approved for ${employee.employee_name}`, 'success');
      fetchQueue();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setApprovingAll(null);
    }
  }

  // Compute total weightage for employee's goals
  function getTotalWeightage(goals) {
    return goals.reduce((sum, g) => sum + parseFloat(g.weightage || 0), 0);
  }

  if (loading) return <AppShell><PageLoader /></AppShell>;

  return (
    <AppShell>
      {/* Header */}
      <div className="gs-page-header">
        <h1 className="text-2xl font-bold text-slate-100">Approval Queue</h1>
        <p className="text-sm text-slate-400 mt-1">
          {queue.length} employee{queue.length !== 1 ? 's' : ''} with pending goals
        </p>
      </div>

      {queue.length === 0 && (
        <div className="gs-card p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm font-medium text-slate-300">All caught up!</p>
          <p className="text-xs text-slate-500 mt-1">No pending goal approvals in your queue.</p>
        </div>
      )}

      {/* Employee approval panels */}
      <div className="space-y-4">
        {queue.map((employee) => {
          const isExpanded = expanded === employee.employee_id;
          const totalW = getTotalWeightage(employee.goals || []);
          const isValidWeightage = Math.abs(totalW - 100) < 0.01;

          return (
            <div key={employee.employee_id} className="gs-card overflow-hidden">
              {/* Employee header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#0f2040] transition-colors"
                onClick={() => setExpanded(isExpanded ? null : employee.employee_id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#162d58] border border-[#1e3a70] flex items-center justify-center text-sm font-bold text-[#60a5fa]">
                    {employee.employee_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{employee.employee_name}</p>
                    <p className="text-xs text-slate-500">{employee.department} · {employee.employee_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-amber-400 bg-amber-900/20 border border-amber-500/20 px-2 py-0.5 rounded">
                    {employee.pending_goals} pending
                  </span>
                  <span className={`text-xs font-mono ${isValidWeightage ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {totalW.toFixed(1)}%
                  </span>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded goals table */}
              {isExpanded && (
                <div className="border-t border-[#162d58]">
                  <div className="overflow-x-auto">
                    <table className="gs-table">
                      <thead>
                        <tr>
                          <th>Goal</th>
                          <th>UoM</th>
                          <th>Target Value</th>
                          <th>Weightage (%)</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(employee.goals || []).map((goal) => {
                          const edit = inlineEdits[goal.id] || {};
                          const isApproving = processing[goal.id] === 'approving';
                          const isReworking = processing[goal.id] === 'reworking';

                          return (
                            <tr key={goal.id}>
                              <td className="max-w-[200px]">
                                <p className="text-sm font-medium text-slate-200 truncate">{goal.title}</p>
                                {goal.is_shared && (
                                  <span className="text-[10px] text-violet-400">🔗 Shared</span>
                                )}
                                {goal.thrust_area && (
                                  <p className="text-xs text-slate-500">{goal.thrust_area}</p>
                                )}
                              </td>
                              <td className="text-xs font-mono text-slate-400">
                                {UOM_ICONS[goal.uom_type]} {goal.uom_type?.toUpperCase()}
                              </td>
                              {/* Inline editable: Target Value */}
                              <td>
                                {['min', 'max'].includes(goal.uom_type) ? (
                                  <input
                                    type="number"
                                    className="gs-input text-xs py-1 px-2 w-28 font-mono"
                                    defaultValue={goal.target_value}
                                    onBlur={(e) => setInlineField(goal.id, 'target_value', parseFloat(e.target.value))}
                                    placeholder="target"
                                  />
                                ) : (
                                  <span className="text-xs text-slate-500 font-mono">
                                    {goal.target_value ? Number(goal.target_value).toLocaleString('en-IN') : '—'}
                                  </span>
                                )}
                              </td>
                              {/* Inline editable: Weightage */}
                              <td>
                                <input
                                  type="number"
                                  min="10"
                                  max="90"
                                  step="1"
                                  className="gs-input text-xs py-1 px-2 w-20 font-mono"
                                  defaultValue={parseFloat(goal.weightage)}
                                  onBlur={(e) => setInlineField(goal.id, 'weightage', parseFloat(e.target.value))}
                                />
                              </td>
                              <td><StatusBadge status={goal.status} /></td>
                              <td>
                                <div className="flex items-center gap-2 justify-end">
                                  <button
                                    onClick={() => handleApprove(goal.id, employee.employee_id)}
                                    disabled={isApproving || isReworking}
                                    className="gs-btn-success text-xs py-1 px-2.5"
                                  >
                                    {isApproving ? '…' : '✓ Approve'}
                                  </button>
                                  <button
                                    onClick={() => { setReworkModal({ goalId: goal.id, title: goal.title }); setReworkComment(''); }}
                                    disabled={isApproving || isReworking}
                                    className="gs-btn-danger text-xs py-1 px-2.5"
                                  >
                                    {isReworking ? '…' : '↩ Rework'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Approve all footer */}
                  <div className="px-5 py-4 border-t border-[#162d58] flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-mono ${isValidWeightage ? 'text-emerald-400' : 'text-amber-400'}`}>
                        Total weightage: {totalW.toFixed(1)}%
                        {!isValidWeightage && ' — must be 100% to approve all'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApproveAll(employee)}
                      disabled={approvingAll === employee.employee_id}
                      className="gs-btn text-sm"
                    >
                      {approvingAll === employee.employee_id ? 'Approving…' : 'Approve All Goals ✓'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rework Modal */}
      <Modal
        isOpen={!!reworkModal}
        onClose={() => setReworkModal(null)}
        title="Return for Rework"
        size="sm"
        footer={
          <>
            <button onClick={() => setReworkModal(null)} className="gs-btn-ghost">Cancel</button>
            <button onClick={handleRework} className="gs-btn-danger">Return for Rework</button>
          </>
        }
      >
        {reworkModal && (
          <div className="space-y-3">
            <div className="px-3 py-2 bg-[#0a1628] border border-[#162d58] rounded text-xs text-slate-300">
              {reworkModal.title}
            </div>
            <div>
              <label className="gs-label">Feedback for Employee *</label>
              <textarea
                className="gs-textarea"
                rows={4}
                value={reworkComment}
                onChange={(e) => setReworkComment(e.target.value)}
                placeholder="Explain what needs to be changed (min 10 characters)…"
                autoFocus
              />
              <p className="text-xs text-slate-600 mt-1">{reworkComment.length} chars (min 10)</p>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
