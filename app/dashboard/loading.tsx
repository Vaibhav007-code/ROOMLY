export default function DashboardLoading() {
  return (
    <div className="page animate-pulse">
      <div style={{ height: 32, background: 'var(--fog)', borderRadius: 6, width: 180, marginBottom: 8 }}></div>
      <div style={{ height: 16, background: 'var(--fog)', borderRadius: 6, width: 280, marginBottom: 28, opacity: 0.5 }}></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="card" style={{ height: 120, background: 'var(--fog)', opacity: 0.3 }}></div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 20, height: 100, background: 'var(--fog)', opacity: 0.3 }}></div>
    </div>
  );
}
