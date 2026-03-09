import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import OutlookBadge from '../components/OutlookBadge';

export default function Predictions() {
  const { data: analysis = [], loading } = useApi('/analysis');
  const sorted = [...analysis].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const majority = sorted.filter(a => a.outlook === 'BULLISH').length > sorted.length / 2 ? 'BULLISH' : sorted.filter(a => a.outlook === 'BEARISH').length > sorted.length / 2 ? 'BEARISH' : 'NEUTRAL';

  if (loading) return <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Generating AI analysis...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>AI Predictions</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Powered by Groq Llama3-70B · Not financial advice</div>
        </div>
        <div className="glass" style={{ padding: '12px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>PORTFOLIO OUTLOOK</div>
          <OutlookBadge outlook={majority} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {sorted.map((a, i) => (
          <motion.div key={a.ticker} className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{a.ticker}</div>
              <OutlookBadge outlook={a.outlook} risk={a.risk_level} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                <span>Confidence</span><span className="mono">{a.confidence}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${a.confidence}%` }} transition={{ delay: i * 0.05 + 0.3, duration: 0.6 }}
                  style={{ height: '100%', background: a.confidence > 70 ? 'var(--accent)' : a.confidence > 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 2 }} />
              </div>
            </div>
            {a.reason && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{a.reason}</div>}
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.1)', borderRadius: 6, fontSize: 10, color: 'var(--warning)' }}>
              AI analysis only · Not financial advice · DYOR
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
