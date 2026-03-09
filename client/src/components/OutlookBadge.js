export default function OutlookBadge({ outlook, confidence, risk }) {
  const map = {
    BULLISH: { bg: 'var(--gain-dim)', color: 'var(--gain)', border: 'rgba(34,197,94,0.2)' },
    BEARISH: { bg: 'var(--loss-dim)', color: 'var(--loss)', border: 'rgba(239,68,68,0.2)' },
    NEUTRAL: { bg: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: 'rgba(245,158,11,0.2)' },
  };
  const riskColor = { LOW: 'var(--gain)', MED: 'var(--warning)', HIGH: 'var(--loss)' };
  const c = map[outlook] || map.NEUTRAL;
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: c.bg, border: `1px solid ${c.border}`, color: c.color, letterSpacing: 0.5 }}>{outlook || 'N/A'}</span>
      {confidence !== undefined && <span className="mono" style={{ fontSize: 10, color: 'var(--text-2)' }}>{confidence}%</span>}
      {risk && <span style={{ fontSize: 10, fontWeight: 600, color: riskColor[risk] || 'var(--text-2)' }}>{risk}</span>}
    </div>
  );
}
