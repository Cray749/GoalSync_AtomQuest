import { useState, useEffect } from 'react';
import AppShell from '../../components/common/AppShell';
import { PageLoader, SkeletonRow } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import { adminService } from '../../services/index.js';
import { fmtDateTime } from '../../utils/formatters';

const ACTION_COLORS = {
  goal_approved:            'text-emerald-400 bg-emerald-900/20 border-emerald-500/30',
  goal_unlocked:            'text-amber-400  bg-amber-900/20  border-amber-500/30',
  goal_unlock_reason:       'text-amber-300  bg-amber-900/15  border-amber-500/20',
  goal_returned_for_rework: 'text-orange-400 bg-orange-900/20 border-orange-500/30',
  goal_inline_edited_by_manager: 'text-blue-400 bg-blue-900/20 border-blue-500/30',
  shared_goal_pushed:       'text-violet-400 bg-violet-900/20 border-violet-500/30',
  user_created:             'text-blue-400   bg-blue-900/20   border-blue-500/30',
  user_login:               'text-slate-400  bg-slate-800/40  border-slate-600/30',
  user_logout:              'text-slate-500  bg-slate-800/30  border-slate-600/20',
  cycle_created:            'text-teal-400   bg-teal-900/20   border-teal-500/30',
  cycle_activated:          'text-teal-400   bg-teal-900/20   border-teal-500/30',
};

function getActionColor(action) {
  return ACTION_COLORS[action] || 'text-slate-400 bg-slate-800/30 border-slate-600/20';
}

const AUDIT_ACTIONS = [
  '', 'goal_approved', 'goal_unlocked', 'goal_unlock_reason',
  'goal_returned_for_rework', 'goal_inline_edited_by_manager',
  'shared_goal_pushed', 'user_created', 'user_login', 'cycle_created', 'cycle_activated',
];

export default function AuditLog() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const LIMIT = 50;

  useEffect(() => { fetchLogs(); }, [page, actionFilter]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = {
        page,
        limit: LIMIT,
        ...(actionFilter ? { action: actionFilter } : {}),
      };
      const res = await adminService.getAuditLogs(params);
      const data = res.data.data;
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AppShell>
      {/* Header */}
      <div className="gs-page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Audit Log</h1>
          <p className="text-sm text-slate-400 mt-1">
            {total.toLocaleString()} total entries · complete change history
          </p>
        </div>
        {/* Filter */}
        <select
          className="gs-select text-xs py-1.5 w-52"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="gs-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gs-table text-xs">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Goal</th>
                <th>Field</th>
                <th>Old Value</th>
                <th>New Value</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    No audit log entries found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="font-mono">
                    <td className="text-slate-500 whitespace-nowrap">
                      {fmtDateTime(log.created_at)}
                    </td>
                    <td>
                      <p className="font-sans font-medium text-slate-200">{log.actor_name}</p>
                      <p className="text-slate-600">{log.actor_email}</p>
                    </td>
                    <td>
                      <span className={`gs-badge border text-[10px] ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="max-w-[140px]">
                      <p className="font-sans text-slate-300 truncate">{log.goal_title || '—'}</p>
                    </td>
                    <td className="text-slate-500">{log.field_name || '—'}</td>
                    <td className="text-red-400/70 max-w-[100px] truncate" title={log.old_value}>
                      {log.old_value || '—'}
                    </td>
                    <td className="text-emerald-400/70 max-w-[160px] truncate" title={log.new_value}>
                      {log.new_value || '—'}
                    </td>
                    <td className="text-slate-600">{log.ip_address || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#162d58]">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} · {total} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="gs-btn-ghost text-xs py-1 px-3 disabled:opacity-30"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="gs-btn-ghost text-xs py-1 px-3 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
