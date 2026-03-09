import { motion } from 'framer-motion';

export default function TickerBanner({ positions = [] }) {
  if (!positions.length) return null;
  const items = [...positions, ...positions];
  return (
    <div style={{ overflow: 'hidden', background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '8px 0', marginBottom: 24 }}>
      <motion.div animate={{ x: [0, -50 * positions.length * 8] }} transition={{ duration: positions.length * 8, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'flex', gap: 40, whiteSpace: 'nowrap', width: 'max-content' }}>
        {items.map((p, i) => {
          const change = p.market?.dailyChangePct || 0;
          return (
            <span key={i} className="mono" style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text)' }}>{p.ticker}</span>
              {' '}
              <span style={{ color: change >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                £{(p.currentPrice || p.averagePrice || 0).toFixed(2)} {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </motion.div>
    </div>
  );
}
