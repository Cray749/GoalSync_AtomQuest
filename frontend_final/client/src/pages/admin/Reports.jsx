import { useState, useEffect } from 'react';
import AppShell from '../../components/common/AppShell';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import ExportButton from '../../components/common/ExportButton';
import ProgressBar from '../../components/common/ProgressBar';
import StatusBadge from '../../components/common/StatusBadge';
import { reportService, adminService } from '../../services/index.js';
import { fmtPct, downloadBlob } from '../../utils/formatters';

export default function Reports() {
  const toast = useToast();
  const [tab, setTab] = useState('achievement');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');

  useEffect(() => { fetchCycles(); }, []);
  useEffect(() => { fetchReport(); }, [tab, selectedCycle]);

  async function fetchCycles() {
    try {
      const res = await adminService.getCycles();
      const list = res.data.data || [];
      setCycles(list);
      const active = list.find((c) => c.is_active);
      if (active) setSelectedCycle(active.id);
    } catch { /* silent */ }
  }

  async function fetchReport() {
    setLoading(true);
    try {
      let res;
      const params = selectedCycle ? { cycle_id: selectedCycle } : {};
      if (tab === 'achievement') res = await reportService.getAchievement(params);
      else if (tab === 'completion') res = await reportService.getCompletionRate(selectedCycle);
      else if (tab === 'distribution') res = await reportService.getGoalDistribution(selectedCycle);
      else if (tab === 'effectiveness') res = await reportService.getManagerEffectiveness(selectedCycle);
      setData(res?.data?.data || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format) {
    const res = await reportService.downloadAchievement(format, selectedCycle);
    const ext = format === 'excel' ? 'xlsx' : 'csv';
    return {
      blob: res.data,
      filename: `achievement_report_${Date.now()}.${ext}`,
    };
  }

  const TABS = [
    { id: 'achievement', label: 'Achievement' },
    { id: 'completion', label: 'Completion Rate' },
    { id: 'distribution', label: 'Goal Distribution' },
    { id: 'effectiveness', label: 'Manager Effectiveness' },
  ];

  return (
    <AppShell>
      <div className="gs-page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reports</h1>
          <p className="text-sm text-slate-400 mt-1">Organisation-wide performance analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="gs-select text-xs py-1.5 w-40"
            value={selectedCycle}
            onChange={(e) => setSelectedCycle(e.target.value)}
          >
            <option value="">All Cycles</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {tab === 'achievement' && (
            <ExportButton onExport={handleExport} label="Export" />
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[#0a1628] border border-[#162d58] rounded-gs-lg mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 text-xs font-medium rounded-gs transition-all ${
              tab === t.id
                ? 'bg-[#2563eb] text-white shadow-glow-sm'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : (
        <>
          {/* Achievement Report */}
          {tab === 'achievement' && (
            <div className="gs-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="gs-table text-xs">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Goal</th>
                      <th>Thrust Area</th>
                      <th>UoM</th>
                      <th>Quarter</th>
                      <th className="text-right">Planned</th>
                      <th className="text-right">Actual</th>
                      <th>Status</th>
                      <th className="text-right">Score %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <p className="font-medium text-slate-200">{row.employee_name}</p>
                          <p className="text-slate-600">{row.department}</p>
                        </td>
                        <td className="max-w-[160px]">
                          <p className="truncate text-slate-300">{row.goal_title}</p>
                          <p className="text-slate-600 font-mono">{row.weightage}% wt</p>
                        </td>
                        <td className="text-slate-400">{row.thrust_area || '—'}</td>
                        <td className="font-mono text-slate-400">{row.uom_type?.toUpperCase()}</td>
                        <td className="font-mono font-semibold text-[#60a5fa]">{row.quarter}</td>
                        <td className="text-right font-mono text-slate-400">
                          {row.planned_value !== null ? Number(row.planned_value).toLocaleString('en-IN') : '—'}
                        </td>
                        <td className="text-right font-mono">
                          <span className={row.actual_value !== null ? 'text-slate-100 font-semibold' : 'text-slate-600'}>
                            {row.actual_value !== null ? Number(row.actual_value).toLocaleString('en-IN') : '—'}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={row.achievement_status} />
                        </td>
                        <td className="text-right">
                          {row.score_pct !== null ? (
                            <span className={`font-mono font-bold ${
                              parseFloat(row.score_pct) >= 100 ? 'text-emerald-400'
                              : parseFloat(row.score_pct) >= 80 ? 'text-blue-400'
                              : parseFloat(row.score_pct) >= 60 ? 'text-amber-400'
                              : 'text-red-400'
                            }`}>
                              {parseFloat(row.score_pct).toFixed(1)}%
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                    {data.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-10 text-slate-500">
                          No data available for the selected cycle.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Completion Rate */}
          {tab === 'completion' && (
            <div className="gs-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="gs-table text-xs">
                  <thead>
                    <tr>
                      <th>Manager</th>
                      <th className="text-center">Team</th>
                      <th className="text-center">Goals</th>
                      <th className="text-center">Q1 Emp</th>
                      <th className="text-center">Q2 Emp</th>
                      <th className="text-center">Q3 Emp</th>
                      <th className="text-center">Q4 Emp</th>
                      <th className="text-center">Q1 Mgr</th>
                      <th className="text-center">Q2 Mgr</th>
                      <th className="text-center">Q3 Mgr</th>
                      <th className="text-center">Q4 Mgr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <p className="font-medium text-slate-200">{row.manager_name}</p>
                          <p className="text-slate-600">{row.department}</p>
                        </td>
                        <td className="text-center font-mono">{row.team_size}</td>
                        <td className="text-center font-mono">{row.total_goals}</td>
                        {['emp_q1_rate','emp_q2_rate','emp_q3_rate','emp_q4_rate',
                          'mgr_q1_rate','mgr_q2_rate','mgr_q3_rate','mgr_q4_rate'].map((k) => (
                          <td key={k} className="text-center">
                            <span className={`font-mono text-xs ${
                              parseFloat(row[k]) >= 80 ? 'text-emerald-400'
                              : parseFloat(row[k]) >= 50 ? 'text-amber-400'
                              : 'text-red-400'
                            }`}>
                              {row[k] !== undefined ? `${parseFloat(row[k]).toFixed(0)}%` : '—'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {data.length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center py-10 text-slate-500">No data.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Goal Distribution */}
          {tab === 'distribution' && data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'By Thrust Area', key: 'by_thrust_area', labelKey: 'thrust_area', valueKey: 'goal_count' },
                { title: 'By UoM Type', key: 'by_uom_type', labelKey: 'uom_type', valueKey: 'goal_count' },
                { title: 'By Status', key: 'by_status', labelKey: 'status', valueKey: 'goal_count' },
              ].map(({ title, key, labelKey, valueKey }) => (
                <div key={key} className="gs-card p-4">
                  <h3 className="gs-section-title mb-3">{title}</h3>
                  <div className="space-y-2">
                    {(data[key] || []).map((item, i) => {
                      const total = (data[key] || []).reduce((s, r) => s + parseInt(r[valueKey] || 0), 0);
                      const pct = total > 0 ? (parseInt(item[valueKey]) / total) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300 capitalize">{item[labelKey] || '—'}</span>
                            <span className="font-mono text-[#60a5fa]">{item[valueKey]}</span>
                          </div>
                          <div className="h-1.5 bg-[#0f2040] rounded-full overflow-hidden">
                            <div className="h-full bg-[#2563eb] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {(data[key] || []).length === 0 && (
                      <p className="text-xs text-slate-600 text-center py-4">No data</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manager Effectiveness */}
          {tab === 'effectiveness' && (
            <div className="gs-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="gs-table text-xs">
                  <thead>
                    <tr>
                      <th>Manager</th>
                      <th className="text-center">Team</th>
                      <th className="text-center">Approval Rate</th>
                      <th className="text-center">Avg Days</th>
                      <th className="text-center">Check-in Coverage</th>
                      <th className="text-center">Total Check-ins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <p className="font-medium text-slate-200">{row.manager_name}</p>
                          <p className="text-slate-600">{row.department}</p>
                        </td>
                        <td className="text-center font-mono">{row.team_size}</td>
                        <td className="text-center">
                          <span className={`font-mono font-bold ${parseFloat(row.approval_rate_pct) >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {row.approval_rate_pct}%
                          </span>
                        </td>
                        <td className="text-center font-mono text-slate-300">
                          {row.avg_days_to_approve || '—'}
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <ProgressBar value={parseFloat(row.checkin_coverage_pct)} showLabel={false} height={4} className="w-16" />
                            <span className="font-mono text-[#60a5fa]">{row.checkin_coverage_pct}%</span>
                          </div>
                        </td>
                        <td className="text-center font-mono text-slate-300">{row.total_checkins}</td>
                      </tr>
                    ))}
                    {data.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500">No data.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
