export default function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
