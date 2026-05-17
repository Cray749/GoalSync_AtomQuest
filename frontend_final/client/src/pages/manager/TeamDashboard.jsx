import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/common/AppShell';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import { managerService } from '../../services/index.js';
import { fmtRelative, fmtPct } from '../../utils/formatters';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getScoreColor } from '../../utils/scoreCalc';
import QoQTrendChart from '../../components/charts/QoQTrendChart';

const STATUS_CONFIG = {
  all_approved:    { label: 'All Approved', color: 'text-emerald-400', dot: 'bg-emerald-400', row: 'bg-emerald-900/5' },
  pending_approval:{ label: 'Pending Approval', color: 'text-amber-400', dot: 'bg-amber-400', row: 'bg-amber-900/5' },
  in_draft:        { label: 'In Draft', color: 'text-blue-400', dot: 'bg-blue-400', row: '' },
  not_started:     { label: 'Not Started', color: 'text-slate-500', dot: 'bg-slate-500', row: '' },
};

export default function TeamDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [team, setTeam] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [teamRes, progressRes] = await Promise.all([
        managerService.getTeam(),
        managerService.getTeamProgress(),
      ]);
      setTeam(teamRes.data.data || []);
      setProgress(progressRes.data.data || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Stats
  const totalMembers = team.length;
  const allApproved = team.filter((m) => m.goal_status === 'all_approved').length;
  const pendingApproval = team.filter((m) => m.goal_status === 'pending_approval').length;

  // Chart data
  const chartData = progress.map((p) => ({
    name: p.employee_name.split(' ')[0],
    score: parseFloat(p.overall_score_pct) || 0,
    full_name: p.employee_name,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="gs-card px-3 py-2 text-xs">
        <p className="text-slate-200 font-medium">{payload[0]?.payload?.full_name}</p>
        <p className="font-mono text-[#60a5fa]">{payload[0]?.value?.toFixed(1)}%</p>
      </div>
    );
  };

  if (loading) return <AppShell><PageLoader /></AppShell>;

  return (
    <AppShell>
      {/* Header */}
      <div className="gs-page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            {totalMembers} direct report{totalMembers !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/manager/approvals')}
          className="gs-btn"
        >
          {pendingApproval > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
              {pendingApproval}
            </span>
          )}
          Approval Queue
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8 animate-stagger">
        {[
          { label: 'Team Size', value: totalMembers, color: '#2563eb' },
          { label: 'All Approved', value: allApproved, color: '#10b981' },
          { label: 'Pending Approval', value: pendingApproval, color: pendingApproval > 0 ? '#f59e0b' : '#64748b' },
        ].map((s) => (
          <div key={s.label} className="gs-stat-card">
            <p className="gs-section-title">{s.label}</p>
            <p className="text-3xl font-mono font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Team progress chart */}
      {chartData.length > 0 && (
        <div className="gs-card p-5 mb-6">
          <h2 className="gs-section-title mb-4">Overall Score by Team Member</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 150]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={getScoreColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Team QoQ trend */}
      {progress.length > 0 && (
        <div className="gs-card p-5 mb-6">
          <h2 className="gs-section-title mb-4">Quarter-over-Quarter Score Trend</h2>
          <QoQTrendChart data={progress} height={220} />
        </div>
      )}

      {/* Team member table */}
      <div className="gs-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#162d58] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Team Members</h2>
          <span className="text-xs text-slate-500">{totalMembers} members</span>
        </div>
        {team.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No direct reports found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="gs-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Goals</th>
                  <th>Status</th>
                  <th>Last Check-in</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {team.map((member) => {
                  const statusCfg = STATUS_CONFIG[member.goal_status] || STATUS_CONFIG['not_started'];
                  const progressData = progress.find((p) => p.employee_id === member.id);
                  return (
                    <tr
                      key={member.id}
                      className={`cursor-pointer ${statusCfg.row}`}
                      onClick={() => navigate(`/manager/approvals?employee=${member.id}`)}
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#162d58] border border-[#1e3a70] flex items-center justify-center text-xs font-bold text-[#60a5fa] shrink-0">
                            {member.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{member.name}</p>
                            <p className="text-xs text-slate-500">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-400 text-xs">{member.department || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-300">
                            {member.approved_goals}/{member.total_goals}
                          </span>
                          <div className="flex-1 max-w-[80px]">
                            <div className="h-1.5 bg-[#0f2040] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: member.total_goals > 0 ? `${(member.approved_goals / member.total_goals) * 100}%` : '0%' }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                          <span className={`text-xs font-medium ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-500">
                        {member.last_checkin_at ? fmtRelative(member.last_checkin_at) : '—'}
                      </td>
                      <td>
                        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
