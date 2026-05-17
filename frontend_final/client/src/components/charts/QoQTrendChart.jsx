import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';
import { getScoreColor } from '../../utils/scoreCalc';

// Palette for up to 10 employees
const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  '#14b8a6', '#a855f7',
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="gs-card px-4 py-3 shadow-glow min-w-[160px]">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="text-xs font-mono font-bold" style={{ color: p.color }}>
            {p.value !== null ? `${Number(p.value).toFixed(1)}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

function CustomDot({ cx, cy, value, color }) {
  if (value === null || value === undefined) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={color}
      stroke="#060d1f"
      strokeWidth={2}
    />
  );
}

/**
 * QoQTrendChart
 * data: array of { employee_name, quarterly_scores: { Q1, Q2, Q3, Q4 } }
 */
export default function QoQTrendChart({ data = [], height = 300 }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-500">
        No trend data available
      </div>
    );
  }

  // Pivot: build [{quarter:'Q1', emp1: score, emp2: score, ...}, ...]
  const chartData = QUARTERS.map((q) => {
    const row = { quarter: q };
    data.forEach((emp) => {
      const score = emp.quarterly_scores?.[q];
      row[emp.employee_name] = score !== null && score !== undefined ? parseFloat(score) : null;
    });
    return row;
  });

  // Only show employees that have at least one non-null score
  const activeEmployees = data.filter((emp) =>
    QUARTERS.some((q) => emp.quarterly_scores?.[q] !== null && emp.quarterly_scores?.[q] !== undefined)
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#162d58" vertical={false} />
        <XAxis
          dataKey="quarter"
          tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: '#162d58' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 150]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        {/* 100% reference line */}
        <ReferenceLine
          y={100}
          stroke="#10b981"
          strokeDasharray="4 3"
          strokeOpacity={0.4}
          label={{ value: '100%', position: 'insideRight', fontSize: 10, fill: '#10b981', opacity: 0.6 }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1e3a70', strokeWidth: 1 }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 12 }}
          iconType="circle"
          iconSize={8}
        />
        {activeEmployees.map((emp, i) => (
          <Line
            key={emp.employee_id || emp.employee_name}
            type="monotone"
            dataKey={emp.employee_name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={(props) => (
              <CustomDot {...props} color={COLORS[i % COLORS.length]} />
            )}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#060d1f' }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
