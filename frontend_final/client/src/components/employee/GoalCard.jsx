import StatusBadge from '../common/StatusBadge';
import ProgressBar from '../common/ProgressBar';
import { fmtDate, UOM_LABELS, UOM_ICONS } from '../../utils/formatters';
import { calculateScore, toDisplayPct } from '../../utils/scoreCalc';

export default function GoalCard({ goal, onEdit, onDelete, onClick, compact = false }) {
  const latestAch = goal.achievements?.slice(-1)[0];
  const rawScore = latestAch
    ? calculateScore(goal.uom_type, goal.target_value, latestAch.actual_value, goal.target_date, latestAch.completion_date)
    : null;
  const displayScore = rawScore !== null ? toDisplayPct(rawScore) : null;

  const canEdit = ['draft', 'rework'].includes(goal.status) && !goal.is_locked;
  const canDelete = goal.status === 'draft';

  return (
    <div
      className={`gs-card-hover cursor-pointer ${compact ? 'p-4' : 'p-5'} transition-all`}
      onClick={() => onClick?.(goal)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={goal.status} />
            {goal.is_shared && (
              <span className="gs-badge text-violet-400 bg-violet-900/20 border border-violet-500/30">
                🔗 Shared
              </span>
            )}
            {goal.is_locked && (
              <span className="gs-badge text-slate-400 bg-slate-800/40 border border-slate-600/30">
                🔒 Locked
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
            {goal.title}
          </h3>
        </div>

        {/* Actions */}
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(goal)}
                className="p-1.5 text-slate-500 hover:text-[#60a5fa] hover:bg-[#0f2040] rounded transition-colors"
                title="Edit goal"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={() => onDelete(goal)}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                title="Delete goal"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {goal.thrust_area_name && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-slate-600 inline-block" />
            {goal.thrust_area_name}
          </span>
        )}
        <span className="text-xs text-slate-500 font-mono">
          {UOM_ICONS[goal.uom_type]} {UOM_LABELS[goal.uom_type]}
        </span>
        {goal.target_date && (
          <span className="text-xs text-slate-500">
            Due {fmtDate(goal.target_date)}
          </span>
        )}
      </div>

      {/* Rework comment */}
      {goal.status === 'rework' && goal.rework_comment && (
        <div className="mb-3 px-3 py-2 bg-red-900/15 border border-red-500/20 rounded text-xs text-red-300 leading-relaxed">
          <span className="font-semibold text-red-400">Manager: </span>
          {goal.rework_comment}
        </div>
      )}

      {/* Score + weightage */}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-[#0f2040]">
          <ProgressBar value={displayScore} />
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        {goal.target_value !== null && goal.target_value !== undefined && (
          <span className="text-xs text-slate-500 font-mono">
            Target: {Number(goal.target_value).toLocaleString('en-IN')}
          </span>
        )}
        <span className="text-xs font-mono font-semibold text-[#60a5fa] ml-auto">
          {parseFloat(goal.weightage)}% weight
        </span>
      </div>
    </div>
  );
}
