const positiveStatuses = new Set(['ACTIVE', 'AVAILABLE', 'SENT', 'PAID']);
const warningStatuses = new Set(['NOT_SENT', 'UNPAID']);

export default function StatusBadge({ status }) {
  const value = status || 'UNKNOWN';
  const tone = positiveStatuses.has(value)
    ? 'positive'
    : warningStatuses.has(value)
      ? 'warning'
      : 'danger';

  return <span className={`status-badge ${tone}`}>{value}</span>;
}
