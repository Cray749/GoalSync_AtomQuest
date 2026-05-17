export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={`inline-flex flex-col items-center gap-3 ${className}`}>
      <svg
        className={`${sizes[size]} animate-spin text-[#2563eb]`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-slate-500 animate-pulse">Loading…</p>
    </div>
  );
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="gs-skeleton h-4 rounded w-full" style={{ animationDelay: `${i * 80}ms` }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="gs-card p-5 space-y-3 animate-pulse">
      <div className="gs-skeleton h-4 rounded w-1/3" />
      <div className="gs-skeleton h-8 rounded w-1/2" />
      <div className="gs-skeleton h-3 rounded w-2/3" />
    </div>
  );
}
