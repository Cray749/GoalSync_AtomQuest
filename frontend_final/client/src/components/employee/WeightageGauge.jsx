import { getTotalWeightage, getWeightageStatus } from '../../utils/formatters';

export default function WeightageGauge({ goals }) {
  const total = getTotalWeightage(goals);
  const status = getWeightageStatus(total);
  const remaining = Math.max(0, 100 - total);
  const overBy = Math.max(0, total - 100);

  // Clamp fill to 100% for visual, but show over-allocation in red
  const fillPct = Math.min((total / 100) * 100, 100);

  const colors = {
    perfect: { bar: '#10b981', text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-900/10' },
    over:    { bar: '#ef4444', text: 'text-red-400',     border: 'border-red-500/30',     bg: 'bg-red-900/10' },
    under:   { bar: '#f59e0b', text: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-900/10' },
  };

  const cfg = colors[status];

  return (
    <div className={`gs-card p-4 border ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weightage Allocation</p>
          <p className={`text-xs mt-0.5 ${cfg.text}`}>
            {status === 'perfect' && '✓ Perfectly allocated — ready to submit'}
            {status === 'over' && `⚠ Over by ${overBy.toFixed(1)}% — reduce before submitting`}
            {status === 'under' && `${remaining.toFixed(1)}% remaining — allocate to submit`}
          </p>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-mono font-bold ${cfg.text}`}>
            {total.toFixed(1)}%
          </span>
          <p className="text-xs text-slate-500 font-mono">/ 100%</p>
        </div>
      </div>

      {/* Bar */}
      <div className="relative w-full h-3 bg-[#060d1f] rounded-full overflow-hidden border border-[#162d58]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out relative"
          style={{
            width: `${fillPct}%`,
            backgroundColor: cfg.bar,
            boxShadow: `0 0 10px ${cfg.bar}60`,
          }}
        />
        {/* 100% marker */}
        <div className="absolute top-0 bottom-0 w-px bg-slate-600" style={{ left: '100%' }} />
      </div>

      {/* Per-goal breakdown */}
      {goals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {goals.map((g) => {
            const w = parseFloat(g.weightage || 0);
            const pct = (w / 100) * 100;
            return (
              <div
                key={g.id}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#0a1628] border border-[#162d58] rounded text-[10px]"
                title={g.title}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.bar, opacity: 0.8 }}
                />
                <span className="text-slate-400 truncate max-w-[100px]">{g.title?.substring(0, 18)}{g.title?.length > 18 ? '…' : ''}</span>
                <span className={`font-mono font-semibold ${cfg.text}`}>{w}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
