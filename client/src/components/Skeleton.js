export function Skeleton({ width = '100%', height = 16, radius = 8, style = {} }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }} />;
}

export function SkeletonCard({ rows = 3, style = {} }) {
  return (
    <div className="card" style={{ padding: 24, ...style }}>
      <Skeleton width="40%" height={12} style={{ marginBottom: 20 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={i % 2 === 0 ? '100%' : '70%'} height={12} style={{ marginBottom: 12 }} />
      ))}
    </div>
  );
}

export function SkeletonMetric({ style = {} }) {
  return (
    <div className="card" style={{ padding: '20px 24px', flex: 1, minWidth: 140, ...style }}>
      <Skeleton width="60%" height={10} style={{ marginBottom: 14 }} />
      <Skeleton width="80%" height={24} style={{ marginBottom: 8 }} />
      <Skeleton width="40%" height={10} />
    </div>
  );
}

export function SkeletonRow({ style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--border)', ...style }}>
      <Skeleton width={40} height={12} />
      <Skeleton width={100} height={12} />
      <Skeleton width={60} height={12} style={{ marginLeft: 'auto' }} />
      <Skeleton width={60} height={12} />
    </div>
  );
}
