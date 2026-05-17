import { STATUS_CONFIG } from '../../utils/formatters';

export default function StatusBadge({ status, className = '' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['draft'];
  return (
    <span
      className={`gs-badge border ${cfg.bg} ${cfg.color} ${cfg.border} ${className}`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          cfg.color.replace('text-', 'bg-')
        }`}
      />
      {cfg.label}
    </span>
  );
}
