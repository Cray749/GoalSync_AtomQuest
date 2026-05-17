import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="gs-card px-4 py-3 shadow-glow min-w-[180px]">
      <p className="text-xs font-semibold text-slate-300 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: p.fill }} />
            {p.name}
          </span>
          <span className="text-xs font-mono font-bold text-slate-200">
            {typeof p.value === 'number' ? `${p.value.toFixed(1)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * ManagerEffectivenessChart
 * Shows approval rate + check-in coverage side-by-side per manager.
 *
 * data: array of {
 *   manager_name, approval_rate_pct, checkin_coverage_pct,
 *   avg_days_to_approve, team_size
 * }
 */
export default function ManagerEffectivenessChart({ data = [], height = 300 }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-500">
        No manager data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.manager_name.split(' ')[0], // first name only for compact display
    full_name: d.manager_name,
    approval: parseFloat(d.approval_rate_pct) || 0,
    checkin: parseFloat(d.checkin_coverage_pct) || 0,
    days: parseFloat(d.avg_days_to_approve) || 0,
    team: d.team_size,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} barCategoryGap="25%" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#162d58" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={{ stroke: '#162d58' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 12 }}
          iconType="rect"
          iconSize={8}
        />
        <Bar dataKey="approval" name="Approval Rate" fill="#10b981" radius={[3, 3, 0, 0]} barSize={14} />
        <Bar dataKey="checkin" name="Check-in Coverage" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}
