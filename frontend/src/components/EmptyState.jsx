export default function EmptyState({ children = 'No data yet.' }) {
  return <div className="empty-state">{children}</div>;
}
