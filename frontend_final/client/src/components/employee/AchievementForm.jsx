import { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../common/Toast';
import { achievementService } from '../../services/index.js';
import { calculateScore, toDisplayPct, getScoreClass, getScoreLabel } from '../../utils/scoreCalc';
import { UOM_LABELS } from '../../utils/formatters';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const STATUSES = ['not_started', 'on_track', 'completed', 'missed'];
const STATUS_LABELS = { not_started: 'Not Started', on_track: 'On Track', completed: 'Completed', missed: 'Missed' };

export default function AchievementForm({ isOpen, onClose, onSuccess, goal, activeQuarter }) {
  const toast = useToast();
  const [quarter, setQuarter] = useState(activeQuarter || 'Q1');
  const [actual, setActual] = useState('');
  const [status, setStatus] = useState('on_track');
  const [completionDate, setCompletionDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live score calculation
  const rawScore = calculateScore(
    goal?.uom_type,
    goal?.target_value,
    actual === '' ? null : parseFloat(actual),
    goal?.target_date,
    completionDate || null
  );
  const displayScore = actual !== '' || completionDate ? toDisplayPct(rawScore) : null;
  const scoreClass = getScoreClass(displayScore);

  const needsValue = ['min', 'max'].includes(goal?.uom_type);
  const needsDate = goal?.uom_type === 'timeline';
  const isZero = goal?.uom_type === 'zero';

  async function handleSubmit() {
    if (needsValue && actual === '') { toast('Please enter your actual value', 'error'); return; }
    if (needsDate && !completionDate) { toast('Please enter completion date', 'error'); return; }

    setSubmitting(true);
    try {
      // Check if existing achievement for this quarter
      const existing = goal.achievements?.find((a) => a.quarter === quarter);
      const payload = {
        goal_id: goal.id,
        quarter,
        actual_value: isZero ? parseFloat(actual || 0) : (needsValue ? parseFloat(actual) : null),
        goal_status: status,
        completion_date: needsDate ? completionDate : null,
      };

      if (existing) {
        await achievementService.updateAchievement(existing.id, payload);
        toast(`${quarter} check-in updated`, 'success');
      } else {
        await achievementService.submitAchievement(payload);
        toast(`${quarter} check-in submitted`, 'success');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Achievement"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="gs-btn-ghost">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="gs-btn">
            {submitting ? 'Saving…' : 'Submit'}
          </button>
        </>
      }
    >
      {goal && (
        <div className="space-y-4">
          {/* Goal info */}
          <div className="px-3 py-2.5 bg-[#0a1628] border border-[#162d58] rounded">
            <p className="text-xs text-slate-400 mb-0.5">Goal</p>
            <p className="text-sm font-medium text-slate-100">{goal.title}</p>
            <p className="text-xs text-slate-500 mt-1">
              {UOM_LABELS[goal.uom_type]}
              {goal.target_value !== null && ` · Target: ${Number(goal.target_value).toLocaleString('en-IN')}`}
            </p>
          </div>

          {/* Quarter selector */}
          <div>
            <label className="gs-label">Quarter</label>
            <div className="flex gap-2">
              {QUARTERS.map((q) => {
                const hasEntry = goal.achievements?.some((a) => a.quarter === q);
                return (
                  <button
                    key={q}
                    onClick={() => setQuarter(q)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-gs border transition-all ${
                      quarter === q
                        ? 'bg-[#2563eb] border-[#2563eb] text-white'
                        : 'bg-transparent border-[#162d58] text-slate-400 hover:border-[#1e3a70]'
                    }`}
                  >
                    {q}
                    {hasEntry && <span className="ml-1 text-emerald-400">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actual value */}
          {needsValue && (
            <div>
              <label className="gs-label">
                Actual Value
                {goal.target_value && (
                  <span className="text-slate-600 normal-case font-normal ml-1">
                    (target: {Number(goal.target_value).toLocaleString('en-IN')})
                  </span>
                )}
              </label>
              <input
                type="number"
                className="gs-input font-mono text-lg"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder="Enter actual achieved value"
                autoFocus
              />
            </div>
          )}

          {/* Timeline completion date */}
          {needsDate && (
            <div>
              <label className="gs-label">Completion Date</label>
              <input
                type="date"
                className="gs-input font-mono"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
              />
            </div>
          )}

          {/* Zero = incidents field */}
          {isZero && (
            <div>
              <label className="gs-label">Number of Incidents / Defects</label>
              <input
                type="number"
                min="0"
                className="gs-input font-mono text-lg"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder="0 = 100% score"
              />
            </div>
          )}

          {/* Live score preview */}
          {displayScore !== null && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-gs border ${
              displayScore >= 100 ? 'bg-emerald-900/10 border-emerald-500/20'
              : displayScore >= 80 ? 'bg-blue-900/10 border-blue-500/20'
              : 'bg-amber-900/10 border-amber-500/20'
            }`}>
              <div>
                <p className="text-xs text-slate-400">Live Score Preview</p>
                <p className="text-xs text-slate-500">{getScoreLabel(displayScore)}</p>
              </div>
              <p className={`text-3xl font-mono font-bold ${scoreClass}`}>
                {displayScore.toFixed(1)}%
              </p>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="gs-label">Achievement Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`py-2 px-3 text-xs font-medium rounded-gs border transition-all text-left ${
                    status === s
                      ? s === 'completed' ? 'bg-emerald-900/20 border-emerald-500/40 text-emerald-400'
                        : s === 'on_track' ? 'bg-blue-900/20 border-blue-500/40 text-blue-400'
                        : s === 'missed' ? 'bg-red-900/20 border-red-500/40 text-red-400'
                        : 'bg-slate-800/40 border-slate-600/40 text-slate-400'
                      : 'bg-transparent border-[#162d58] text-slate-500 hover:border-[#1e3a70]'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
