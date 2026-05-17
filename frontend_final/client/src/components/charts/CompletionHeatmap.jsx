/**
 * CompletionHeatmap
 * Renders a department × quarter grid.
 * Cell color intensity = completion % (0→red, 50→amber, 80→green, 100→bright green)
 *
 * data: array of {
 *   department, total_employees, submitted, approved,
 *   q1_actuals, q2_actuals, q3_actuals, q4_actuals, total_goals_in_cycle
 * }
 */

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

function getPct(actual, total) {
  const a = parseInt(actual) || 0;
  const t = parseInt(total) || 0;
  if (t === 0) return null;
  return Math.min((a / t) * 100, 100);
}

function getCellColor(pct) {
  if (pct === null) return { bg: 'bg-[#0a1628]', text: 'text-slate-700', border: 'border-[#0f2040]' };
  if (pct >= 90) return { bg: 'bg-emerald-900/40', text: 'text-emerald-300', border: 'border-emerald-500/30' };
  if (pct >= 70) return { bg: 'bg-emerald-900/20', text: 'text-emerald-400', border: 'border-emerald-500/20' };
  if (pct >= 50) return { bg: 'bg-amber-900/20',   text: 'text-amber-400',   border: 'border-amber-500/20' };
  if (pct >= 25) return { bg: 'bg-orange-900/20',  text: 'text-orange-400',  border: 'border-orange-500/20' };
  return { bg: 'bg-red-900/20', text: 'text-red-400', border: 'border-red-500/20' };
}

export default function CompletionHeatmap({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-500">
        No department data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        {/* Header */}
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider w-40">
              Department
            </th>
            <th className="px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider text-center">
              Team
            </th>
            <th className="px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider text-center">
              Goals Set
            </th>
            {QUARTERS.map((q) => (
              <th key={q} className="px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider text-center">
                {q} Check-ins
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => {
            const quarterKeys = ['q1_actuals', 'q2_actuals', 'q3_actuals', 'q4_actuals'];
            const submissionPct = getPct(row.submitted, row.total_employees);
            const submissionColors = getCellColor(submissionPct);

            return (
              <tr key={row.department} className="border-t border-[#0f2040]">
                {/* Department name */}
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-200">{row.department}</p>
                </td>

                {/* Team size */}
                <td className="px-3 py-3 text-center">
                  <span className="font-mono text-slate-400">{row.total_employees}</span>
                </td>

                {/* Goal submission rate */}
                <td className="px-3 py-3 text-center">
                  <div className={`inline-flex flex-col items-center px-3 py-1.5 rounded-gs border ${submissionColors.bg} ${submissionColors.border}`}>
                    <span className={`font-mono font-bold text-sm ${submissionColors.text}`}>
                      {submissionPct !== null ? `${submissionPct.toFixed(0)}%` : '—'}
                    </span>
                    <span className="text-slate-600 text-[10px] mt-0.5">
                      {row.approved}/{row.total_employees}
                    </span>
                  </div>
                </td>

                {/* Quarter check-in cells */}
                {quarterKeys.map((key, qi) => {
                  const pct = getPct(row[key], row.total_goals_in_cycle);
                  const colors = getCellColor(pct);

                  return (
                    <td key={key} className="px-3 py-3 text-center">
                      <div
                        className={`
                          inline-flex flex-col items-center
                          px-3 py-1.5 rounded-gs border
                          transition-all duration-200
                          ${colors.bg} ${colors.border}
                        `}
                        title={pct !== null ? `${pct.toFixed(1)}% completion (${row[key]}/${row.total_goals_in_cycle} goals)` : 'No data'}
                      >
                        <span className={`font-mono font-bold text-sm ${colors.text}`}>
                          {pct !== null ? `${pct.toFixed(0)}%` : '—'}
                        </span>
                        <span className="text-slate-600 text-[10px] mt-0.5">
                          {parseInt(row[key]) || 0}/{parseInt(row.total_goals_in_cycle) || 0}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>

        {/* Legend */}
        <tfoot>
          <tr>
            <td colSpan={7} className="px-3 pt-4 pb-2">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-slate-600">Intensity:</span>
                {[
                  { label: '≥90%', ...getCellColor(95) },
                  { label: '70–89%', ...getCellColor(75) },
                  { label: '50–69%', ...getCellColor(55) },
                  { label: '25–49%', ...getCellColor(35) },
                  { label: '<25%', ...getCellColor(10) },
                  { label: 'No data', ...getCellColor(null) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded border ${item.bg} ${item.border}`} />
                    <span className="text-xs text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
