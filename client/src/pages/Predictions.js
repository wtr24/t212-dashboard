import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import OutlookBadge from '../components/OutlookBadge';
import { Cpu } from 'lucide-react';

export default function Predictions() {
  const { data: rawAnalysis, loading } = useApi('/analysis');
  const analysis = Array.isArray(rawAnalysis) ? rawAnalysis : [];
  const sorted = [...analysis].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const bullish = sorted.filter(a => a.outlook === 'BULLISH').length;
  const bearish = sorted.filter(a => a.outlook === 'BEARISH').length;
  const majority = bullish > sorted.length / 2 ? 'BULLISH' : bearish > sorted.length / 2 ? 'BEARISH' : 'NEUTRAL';
  const outlookColor = majority === 'BULLISH' ? 'var(--gain)' : majority === 'BEARISH' ? 'var(--loss)' : 'var(--warning)';
  const outlookBg = majority === 'BULLISH' ? 'var(--gain-dim)' : majority === 'BEARISH' ? 'var(--loss-dim)' : 'var(--warning-dim)';

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, color: 'var(--text-3)' }}>
      <Cpu size={32} style={{ marginBottom: 16, opacity: 0.4 }} />
      <div style={{ fontWeight: 500 }}>Generating AI analysis...</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>Powered by Groq Llama3-70B</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>AI Predictions</h2>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Powered by Groq Llama3-70B · Not financial advice</div>
        </div>
        {sorted.length > 0 && (
          <div className="card" style={{ padding: '14px 22px', textAlign: 'center', background: outlookBg, borderColor: `${outlookColor}30` }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Portfolio Outlook</div>
            <OutlookBadge outlook={majority} />
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{bullish}B · {bearish}Be · {sorted.length - bullish - bearish}N</div>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 16px', background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 24, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
        ⚠ AI analysis is for informational purposes only. Not financial advice. Always do your own research.
      </div>

      {sorted.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
          <Cpu size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No analysis available</div>
          <div style={{ fontSize: 12 }}>Add your Groq API key and portfolio data to generate AI signals.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {sorted.map((a, i) => {
            const confColor = a.confidence > 70 ? 'var(--gain)' : a.confidence > 40 ? 'var(--warning)' : 'var(--loss)';
            return (
              <motion.div key={a.ticker} className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 17, fontFamily: 'DM Mono, monospace' }}>{a.ticker}</div>
                  <OutlookBadge outlook={a.outlook} risk={a.risk_level} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 6, fontWeight: 500 }}>
                    <span>Confidence</span><span className="mono">{a.confidence}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${a.confidence}%` }} transition={{ delay: i * 0.05 + 0.3, duration: 0.6 }}
                      style={{ height: '100%', background: confColor, borderRadius: 3 }} />
                  </div>
                </div>
                {a.reason && <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{a.reason}</div>}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
