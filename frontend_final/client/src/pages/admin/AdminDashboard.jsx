import { useState, useEffect } from 'react';
import AppShell from '../../components/common/AppShell';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import { adminService } from '../../services/index.js';
import { fmtPct, fmtDate } from '../../utils/formatters';

export default function AdminDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [statsRes, compRes] = await Promise.all([
        adminService.getOrgStats(),
        adminService.getCompletionDashboard(),
      ]);
      setStats(statsRes.data.data);
      setCompletion(compRes.data.data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <AppShell><PageLoader /></AppShell>;

  const topStats = [
    { label: 'Total Employees', value: stats?.users?.employees || 0, color: '#2563eb' },
    { label: 'Goals Submitted', value: stats?.goals?.submission_rate_pct != null ? `${stats.goals.submission_rate_pct}%` : '—', color: '#10b981' },
    { label: 'Goals Approved', value: stats?.goals?.approved || 0, color: '#f59e0b' },
    { label: 'Approval Rate', value: stats?.goals?.approval_rate_pct != null ? `${stats.goals.approval_rate_pct}%` : '—', color: '#8b5cf6' },
  ];

  const employees = completion?.employees || [];

  return (
    <AppShell>
      <div className="gs-page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Admin Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            {stats?.cycle?.name || 'No active cycle'} · Organisation-wide metrics
          </p>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-stagger">
        {topStats.map((s) => (
          <div key={s.label} className="gs-stat-card">
            <p className="gs-section-title">{s.label}</p>
            <p className="text-3xl font-mono font-bold gs-number" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Goal breakdown */}
      {stats?.goals && (
        <div className="gs-card p-5 mb-6">
          <h2 className="gs-section-title mb-4">Goal Status Breakdown</h2>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'Draft', value: stats.goals.draft, color: '#64748b' },
              { label: 'Submitted', value: stats.goals.submitted, color: '#f59e0b' },
              { label: 'Approved', value: stats.goals.approved, color: '#10b981' },
              { label: 'Rework', value: stats.goals.rework, color: '#ef4444' },
            ].map((item) => (
              <div key={item.label} className="flex-1 min-w-[100px] px-4 py-3 bg-[#0a1628] border border-[#162d58] rounded-gs text-center">
                <p className="text-2xl font-mono font-bold" style={{ color: item.color }}>{item.value}</p>
                <p className="text-xs text-slate-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion table */}
      <div className="gs-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#162d58] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Employee Completion Status</h2>
          <span className="text-xs text-slate-500">{employees.length} employees</span>
        </div>
        <div className="overflow-x-auto">
          <table className="gs-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Dept</th>
                <th>Manager</th>
                <th className="text-center">Goals</th>
                <th className="text-center">Q1</th>
                <th className="text-center">Q2</th>
                <th className="text-center">Q3</th>
                <th className="text-center">Q4</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const hasGoals = parseInt(emp.total_goals) > 0;
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#162d58] flex items-center justify-center text-xs font-bold text-[#60a5fa] shrink-0">
                          {emp.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">{emp.name}</p>
                          <p className="text-xs text-slate-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-slate-400">{emp.department || '—'}</td>
                    <td className="text-xs text-slate-400">{emp.manager_name || '—'}</td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <span className={`text-xs font-mono ${parseInt(emp.approved_goals) > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {emp.approved_goals}/{emp.total_goals}
                        </span>
                      </div>
                    </td>
                    {['q1_checkins', 'q2_checkins', 'q3_checkins', 'q4_checkins'].map((q) => (
                      <td key={q} className="text-center">
                        {parseInt(emp[q]) > 0 ? (
                          <span className="text-emerald-400 text-xs font-mono">✓ {emp[q]}</span>
                        ) : (
                          <span className="text-slate-700 text-xs">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-sm text-slate-500">
                    No employee data found for the active cycle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
