import { useState, useEffect } from 'react';
import AppShell from '../../components/common/AppShell';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import QoQTrendChart from '../../components/charts/QoQTrendChart';
import CompletionHeatmap from '../../components/charts/CompletionHeatmap';
import { GoalDistributionPie, UoMDistributionBar, StatusDistributionBar } from '../../components/charts/GoalDistributionCharts';
import ManagerEffectivenessChart from '../../components/charts/ManagerEffectivenessChart';
import { reportService, adminService } from '../../services/index.js';

export default function Analytics() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');

  // Data
  const [qoqData, setQoqData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [distributionData, setDistributionData] = useState(null);
  const [effectivenessData, setEffectivenessData] = useState([]);

  useEffect(() => { fetchCycles(); }, []);
  useEffect(() => { if (selectedCycle !== undefined) fetchAll(); }, [selectedCycle]);

  async function fetchCycles() {
    try {
      const res = await adminService.getCycles();
      const list = res.data.data || [];
      setCycles(list);
      const active = list.find((c) => c.is_active);
      setSelectedCycle(active?.id || '');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const params = selectedCycle ? { cycle_id: selectedCycle } : {};
      const [qoqRes, heatmapRes, distRes, effRes] = await Promise.all([
        reportService.getQoQTrend(params),
        adminService.getCompletionDashboard(selectedCycle).catch(() => ({ data: { data: { employees: [] } } })),
        reportService.getGoalDistribution(selectedCycle),
        reportService.getManagerEffectiveness(selectedCycle),
      ]);

      // QoQ data lives inside the goalDistribution response as qoq_trend
      setQoqData(qoqRes.data.data?.qoq_trend || []);

      // Heatmap — build from completion dashboard grouped by department
      const employees = heatmapRes.data.data?.employees || [];
      const byDept = {};
      for (const emp of employees) {
        const dept = emp.department || 'Unassigned';
        if (!byDept[dept]) {
          byDept[dept] = {
            department: dept,
            total_employees: 0,
            submitted: 0,
            approved: 0,
            q1_actuals: 0,
            q2_actuals: 0,
            q3_actuals: 0,
            q4_actuals: 0,
            total_goals_in_cycle: 0,
          };
        }
        byDept[dept].total_employees++;
        byDept[dept].submitted += parseInt(emp.submitted) > 0 ? 1 : 0;
        byDept[dept].approved  += parseInt(emp.approved)  > 0 ? 1 : 0;
        byDept[dept].total_goals_in_cycle += parseInt(emp.total_goals) || 0;
      }
      setHeatmapData(Object.values(byDept));

      // Distribution
      setDistributionData(distRes.data.data || {});

      // Manager effectiveness
      setEffectivenessData(effRes.data.data || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const activeCycle = cycles.find((c) => c.id === selectedCycle);

  return (
    <AppShell>
      {/* Header */}
      <div className="gs-page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            {activeCycle?.name || 'All cycles'} · Performance insights
          </p>
        </div>
        <select
          className="gs-select text-xs py-1.5 w-44"
          value={selectedCycle}
          onChange={(e) => setSelectedCycle(e.target.value)}
        >
          <option value="">All Cycles</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-6 animate-stagger">

          {/* ── Row 1: QoQ Trend (full width) ────────────────────────────── */}
          <section className="gs-card p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-slate-200">Quarter-over-Quarter Score Trend</h2>
              <span className="text-xs text-slate-500">Weighted score % per employee per quarter</span>
            </div>
            <p className="gs-section-title mb-4">QoQ PERFORMANCE</p>
            {qoqData.length > 0 ? (
              <QoQTrendChart data={qoqData} height={280} />
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-slate-500">
                No quarterly data yet — achievements will appear here once check-ins are logged
              </div>
            )}
          </section>

          {/* ── Row 2: Distribution (2 col) ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Pie: by Thrust Area */}
            <section className="gs-card p-5">
              <h2 className="text-sm font-semibold text-slate-200 mb-1">Goals by Thrust Area</h2>
              <p className="gs-section-title mb-4">DISTRIBUTION</p>
              <GoalDistributionPie
                data={distributionData?.by_thrust_area || []}
                height={260}
              />
            </section>

            {/* Bars: UoM + Status */}
            <section className="gs-card p-5">
              <h2 className="text-sm font-semibold text-slate-200 mb-1">Goals by UoM Type</h2>
              <p className="gs-section-title mb-4">MEASUREMENT METHOD</p>
              <UoMDistributionBar
                data={distributionData?.by_uom_type || []}
                height={130}
              />
              <div className="gs-divider" />
              <h2 className="text-sm font-semibold text-slate-200 mb-1 mt-1">Goals by Status</h2>
              <p className="gs-section-title mb-3">CURRENT STATUS</p>
              <StatusDistributionBar
                data={distributionData?.by_status || []}
                height={130}
              />
            </section>
          </div>

          {/* ── Row 3: Manager Effectiveness ─────────────────────────────── */}
          <section className="gs-card p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-slate-200">Manager Effectiveness</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                  Approval Rate
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                  Check-in Coverage
                </span>
              </div>
            </div>
            <p className="gs-section-title mb-4">APPROVAL RATE vs CHECK-IN COVERAGE</p>
            {effectivenessData.length > 0 ? (
              <>
                <ManagerEffectivenessChart data={effectivenessData} height={260} />
                {/* Detail table below chart */}
                <div className="mt-5 pt-4 border-t border-[#162d58] overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider">Manager</th>
                        <th className="text-center px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider">Team</th>
                        <th className="text-center px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider">Approval Rate</th>
                        <th className="text-center px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider">Avg Days to Approve</th>
                        <th className="text-center px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider">Check-in Coverage</th>
                        <th className="text-center px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider">Total Check-ins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effectivenessData.map((row) => (
                        <tr key={row.manager_id} className="border-t border-[#0f2040]">
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-slate-200">{row.manager_name}</p>
                            <p className="text-slate-600">{row.department}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-400">{row.team_size}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`font-mono font-bold ${
                              parseFloat(row.approval_rate_pct) >= 90 ? 'text-emerald-400'
                              : parseFloat(row.approval_rate_pct) >= 70 ? 'text-amber-400'
                              : 'text-red-400'
                            }`}>
                              {row.approval_rate_pct}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                            {row.avg_days_to_approve ? `${row.avg_days_to_approve}d` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`font-mono font-bold ${
                              parseFloat(row.checkin_coverage_pct) >= 80 ? 'text-emerald-400'
                              : parseFloat(row.checkin_coverage_pct) >= 50 ? 'text-amber-400'
                              : 'text-red-400'
                            }`}>
                              {row.checkin_coverage_pct}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-400">{row.total_checkins}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-slate-500">
                No manager data available
              </div>
            )}
          </section>

          {/* ── Row 4: Completion Heatmap ─────────────────────────────────── */}
          <section className="gs-card p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-1">Completion Heatmap</h2>
            <p className="gs-section-title mb-4">DEPARTMENT × QUARTER</p>
            <CompletionHeatmap data={heatmapData} />
          </section>

        </div>
      )}
    </AppShell>
  );
}
