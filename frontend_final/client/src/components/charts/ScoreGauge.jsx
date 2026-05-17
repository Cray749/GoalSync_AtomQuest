import { getScoreColor, getScoreLabel } from '../../utils/scoreCalc';

/**
 * ScoreGauge — SVG radial arc showing a score 0–150%
 * Used in employee dashboard and manager team view
 */
export default function ScoreGauge({ score, size = 120, label = null, subLabel = null }) {
  const pct = score === null || score === undefined ? 0 : Math.min(score, 150);
  const color = getScoreColor(score);
  const scoreLabel = label || getScoreLabel(score);

  // Arc math
  const radius = (size / 2) - 10;
  const circumference = Math.PI * radius; // half circle = π * r
  const strokeWidth = size * 0.1;

  // 0% → full stroke offset (nothing filled), 100% → half offset, 150% → no offset
  const progress = pct / 150; // 0 to 1
  const dashOffset = circumference * (1 - progress);

  // Center of SVG
  const cx = size / 2;
  const cy = size / 2;

  // Arc starts at left (180°) and ends at right (0°)
  const startX = cx - radius;
  const endX = cx + radius;
  const arcY = cy;

  const arcPath = `M ${startX} ${arcY} A ${radius} ${radius} 0 0 1 ${endX} ${arcY}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size / 2 + 20 }}>
        <svg
          width={size}
          height={size / 2 + 20}
          viewBox={`0 0 ${size} ${size / 2 + 20}`}
          overflow="visible"
        >
          {/* Background track */}
          <path
            d={arcPath}
            fill="none"
            stroke="#0f2040"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Glow effect */}
          {pct > 0 && (
            <path
              d={arcPath}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth + 4}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              opacity={0.12}
            />
          )}
          {/* Progress arc */}
          <path
            d={arcPath}
            fill="none"
            stroke={pct > 0 ? color : '#1e3a70'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
          />
          {/* Score text */}
          <text
            x={cx}
            y={arcY + 6}
            textAnchor="middle"
            fontSize={size * 0.18}
            fontWeight="700"
            fontFamily="JetBrains Mono"
            fill={score !== null ? color : '#334155'}
          >
            {score !== null ? `${Number(score).toFixed(1)}%` : '—'}
          </text>
          {/* 0% label */}
          <text x={startX - 4} y={arcY + strokeWidth / 2 + 14} textAnchor="end" fontSize={9} fill="#475569" fontFamily="JetBrains Mono">0</text>
          {/* 150% label */}
          <text x={endX + 4} y={arcY + strokeWidth / 2 + 14} textAnchor="start" fontSize={9} fill="#475569" fontFamily="JetBrains Mono">150</text>
        </svg>
      </div>
      {/* Labels */}
      <div className="text-center">
        <p className="text-xs font-semibold" style={{ color: score !== null ? color : '#475569' }}>
          {scoreLabel}
        </p>
        {subLabel && <p className="text-xs text-slate-600 mt-0.5">{subLabel}</p>}
      </div>
    </div>
  );
}
