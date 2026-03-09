import { motion } from 'framer-motion';

export default function TickerBanner({ positions = [] }) {
  if (!positions.length) return null;
  const items = [...positions, ...positions];
  return (
    <div style={{ overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 0', marginBottom: 28 }}>
      <motion.div animate={{ x: [0, -180 * positions.length] }} transition={{ duration: positions.length * 6, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', width: 'max-content' }}>
        {items.map((p, i) => {
          const change = p.market?.dailyChangePct || 0;
          const isPos = change >= 0;
          return (
            <span key={i} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.ticker}</span>
              <span className="mono" style={{ color: 'var(--text-2)' }}>£{(p.currentPrice || p.averagePrice || 0).toFixed(2)}</span>
              <span className="mono" style={{ color: isPos ? 'var(--gain)' : 'var(--loss)', fontSize: 11 }}>
                {isPos ? '+' : ''}{change.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </motion.div>
    </div>
  );
}
