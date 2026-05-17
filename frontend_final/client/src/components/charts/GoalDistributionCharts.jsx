import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316',
];

const UOM_LABELS = {
  min: 'Higher is Better',
  max: 'Lower is Better',
  timeline: 'Date-Based',
  zero: 'Zero = Success',
};

// ── Pie Tooltip ───────────────────────────────────────────────────────────────
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="gs-card px-3 py-2 shadow-glow">
      <p className="text-xs font-semibold text-slate-200">{d.name}</p>
      <p className="text-xs font-mono text-slate-400 mt-0.5">
        {d.value} goal{d.value !== 1 ? 's' : ''} · {d.payload.pct}%
      </p>
    </div>
  );
}

// ── Bar Tooltip ───────────────────────────────────────────────────────────────
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="gs-card px-3 py-2 shadow-glow">
      <p className="text-xs font-semibold text-slate-200">{label}</p>
      <p className="text-xs font-mono text-[#3b82f6] mt-0.5">{payload[0]?.value} goals</p>
    </div>
  );
}

// ── Custom Pie Label ──────────────────────────────────────────────────────────
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct, value }) {
  if (parseFloat(pct) < 8) return null; // skip tiny slices
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight="600"
      fontFamily="JetBrains Mono"
    >
      {pct}%
    </text>
  );
}

/**
 * GoalDistributionPie
 * data: array of { thrust_area, goal_count }
 */
export function GoalDistributionPie({ data = [], height = 280 }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-500">
        No data available
      </div>
    );
  }

  const total = data.reduce((s, d) => s + parseInt(d.goal_count || 0), 0);
  const chartData = data.map((d) => ({
    name: d.thrust_area || 'Unassigned',
    value: parseInt(d.goal_count || 0),
    pct: total > 0 ? ((parseInt(d.goal_count) / total) * 100).toFixed(1) : '0',
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="48%"
          outerRadius={100}
          innerRadius={48}
          paddingAngle={2}
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
        >
          {chartData.map((_, i) => (
            <Cell
              key={i}
              fill={COLORS[i % COLORS.length]}
              stroke="#060d1f"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
          formatter={(value) =>
            value.length > 22 ? value.substring(0, 22) + '…' : value
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * UoMDistributionBar
 * data: array of { uom_type, goal_count }
 */
export function UoMDistributionBar({ data = [], height = 200 }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-500">
        No data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: UOM_LABELS[d.uom_type] || d.uom_type,
    count: parseInt(d.goal_count || 0),
    uom: d.uom_type,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#162d58" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * StatusDistributionBar
 * data: array of { status, goal_count }
 */
export function StatusDistributionBar({ data = [], height = 160 }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-slate-500">
        No data
      </div>
    );
  }

  const STATUS_COLORS = {
    draft: '#64748b',
    submitted: '#f59e0b',
    approved: '#10b981',
    rework: '#ef4444',
  };

  const chartData = data.map((d) => ({
    name: d.status?.charAt(0).toUpperCase() + d.status?.slice(1) || d.status,
    count: parseInt(d.goal_count || 0),
    status: d.status,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#162d58" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
