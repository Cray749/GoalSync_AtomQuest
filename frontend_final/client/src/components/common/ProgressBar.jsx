import { getScoreColor } from '../../utils/scoreCalc';

export default function ProgressBar({ value, max = 150, showLabel = true, height = 6, className = '' }) {
  const pct = value === null || value === undefined ? null : Math.min((value / max) * 100, 100);
  const color = getScoreColor(value);

  return (
    <div className={`w-full ${className}`}>
      <div
        className="w-full rounded-full overflow-hidden bg-[#0f2040]"
        style={{ height: `${height}px` }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: pct !== null ? `${pct}%` : '0%',
            backgroundColor: color,
            boxShadow: pct !== null && pct > 0 ? `0 0 8px ${color}60` : 'none',
          }}
        />
      </div>
      {showLabel && value !== null && value !== undefined && (
        <span
          className="text-xs font-mono mt-1 inline-block"
          style={{ color }}
        >
          {Number(value).toFixed(1)}%
          {value >= 100 && <span className="ml-1 text-emerald-300">↑</span>}
        </span>
      )}
    </div>
  );
}
