import { motion } from 'framer-motion';

export default function FearGreedGauge({ score = 50, rating = 'Neutral' }) {
  const angle = -135 + (score / 100) * 270;
  const color = score < 25 ? 'var(--loss)' : score < 45 ? 'var(--warning)' : score < 55 ? 'var(--text-2)' : score < 75 ? '#22c55e' : 'var(--gain)';
  const label = score < 20 ? 'Extreme Fear' : score < 40 ? 'Fear' : score < 60 ? 'Neutral' : score < 80 ? 'Greed' : 'Extreme Greed';
  return (
    <div style={{ textAlign: 'center', padding: 20 }}>
      <div className="label" style={{ marginBottom: 14 }}>Fear & Greed</div>
      <svg width="140" height="90" viewBox="0 0 140 90">
        <path d="M 15 80 A 55 55 0 1 1 125 80" fill="none" stroke="var(--surface-2)" strokeWidth="6" strokeLinecap="round" />
        <path d="M 15 80 A 55 55 0 1 1 125 80" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 172} 172`} opacity="0.9" />
        <motion.g initial={{ rotate: -135 }} animate={{ rotate: angle }} style={{ transformOrigin: '70px 80px' }} transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}>
          <line x1="70" y1="80" x2="70" y2="34" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="70" cy="80" r="3" fill={color} />
        </motion.g>
        <text x="70" y="68" textAnchor="middle" fill="var(--text)" fontFamily="Space Mono" fontSize="16" fontWeight="700">{score}</text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
    </div>
  );
}
