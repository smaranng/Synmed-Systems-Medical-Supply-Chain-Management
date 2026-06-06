interface StatusBadgeProps {
  reorder: boolean;
}

function StatusBadge({ reorder }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        reorder
          ? 'border border-rose-300/60 bg-rose-100 text-rose-800'
          : 'border border-emerald-300/60 bg-emerald-100 text-emerald-800'
      }`}
    >
      {reorder ? '🔴 Reorder Required' : '🟢 Stock Sufficient'}
    </span>
  );
}

export default StatusBadge;
