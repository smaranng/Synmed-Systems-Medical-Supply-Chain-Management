import { ProcurementPriority } from '../api/api';

interface PriorityBadgeProps {
  priority: ProcurementPriority;
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const className =
    priority === 'HIGH'
      ? 'border border-rose-300/60 bg-rose-100 text-rose-800'
      : priority === 'MEDIUM'
        ? 'border border-amber-300/60 bg-amber-100 text-amber-800'
        : 'border border-emerald-300/60 bg-emerald-100 text-emerald-800';

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {priority}
    </span>
  );
}

export default PriorityBadge;
