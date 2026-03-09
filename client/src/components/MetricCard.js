import { motion } from 'framer-motion';
import CountUp from './CountUp';

export default function MetricCard({ label, value, prefix = '£', suffix = '', isPercent, positive, delay = 0 }) {
  const num = parseFloat(value) || 0;
  const isPos = positive !== undefined ? positive : num >= 0;
  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}
      style={{ padding: '20px 24px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: isPos ? 'var(--accent)' : 'var(--danger)' }}>
        {prefix}<CountUp value={Math.abs(num)} decimals={2} />{suffix}
      </div>
      {num !== 0 && <div style={{ fontSize: 11, color: isPos ? 'var(--accent)' : 'var(--danger)', marginTop: 4 }}>{isPos ? '▲' : '▼'}</div>}
    </motion.div>
  );
}
