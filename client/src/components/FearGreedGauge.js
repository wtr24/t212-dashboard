import { motion } from 'framer-motion';

export default function FearGreedGauge({ score = 50, rating = 'Neutral' }) {
  const angle = -135 + (score / 100) * 270;
  const color = score < 25 ? '#ff3257' : score < 45 ? '#ffb800' : score < 55 ? '#e6edf3' : score < 75 ? '#00cc66' : '#00ff88';
  const labels = ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'];
  const label = score < 20 ? labels[0] : score < 40 ? labels[1] : score < 60 ? labels[2] : score < 80 ? labels[3] : labels[4];
  return (
    <div style={{ textAlign: 'center', padding: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Fear & Greed Index</div>
      <svg width="160" height="100" viewBox="0 0 160 100">
        <path d="M 20 90 A 60 60 0 1 1 140 90" fill="none" stroke="var(--border)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 20 90 A 60 60 0 1 1 140 90" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 188} 188`} opacity="0.8" />
        <motion.g initial={{ rotate: -135 }} animate={{ rotate: angle }} style={{ transformOrigin: '80px 90px' }} transition={{ duration: 1.2, ease: 'easeOut' }}>
          <line x1="80" y1="90" x2="80" y2="38" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="80" cy="90" r="4" fill={color} />
        </motion.g>
        <text x="80" y="78" textAnchor="middle" fill="var(--text)" fontFamily="Space Mono" fontSize="18" fontWeight="700">{score}</text>
      </svg>
      <div style={{ color, fontSize: 13, fontWeight: 600 }}>{label}</div>
    </div>
  );
}
