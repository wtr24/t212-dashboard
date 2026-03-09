export default function OutlookBadge({ outlook, confidence, risk }) {
  const colors = { BULLISH: { bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)', text: 'var(--accent)' }, BEARISH: { bg: 'rgba(255,50,87,0.1)', border: 'rgba(255,50,87,0.3)', text: 'var(--danger)' }, NEUTRAL: { bg: 'rgba(255,184,0,0.1)', border: 'rgba(255,184,0,0.3)', text: 'var(--warning)' } };
  const riskColors = { LOW: 'var(--accent)', MED: 'var(--warning)', HIGH: 'var(--danger)' };
  const c = colors[outlook] || colors.NEUTRAL;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontWeight: 700 }}>{outlook || 'N/A'}</span>
      {confidence !== undefined && <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{confidence}%</span>}
      {risk && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--glass)', border: '1px solid var(--border)', color: riskColors[risk] || 'var(--muted)' }}>{risk}</span>}
    </div>
  );
}
