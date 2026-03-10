import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle, Zap, Settings } from 'lucide-react';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

const SIGNAL_CONFIG = {
  'STRONG BUY': { color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', glow: 'rgba(16,185,129,0.2)', order: 0 },
  'BUY':        { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.35)', glow: 'rgba(52,211,153,0.15)', order: 1 },
  'HOLD':       { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', glow: 'rgba(59,130,246,0.15)', order: 2 },
  'SELL':       { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', glow: 'rgba(249,115,22,0.15)', order: 3 },
  'STRONG SELL':{ color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', glow: 'rgba(239,68,68,0.2)', order: 4 },
};

const OUTLOOK_COLOR = { BULLISH: '#10b981', BEARISH: '#ef4444', NEUTRAL: '#3b82f6' };

function ConfidenceRing({ pct, color, size = 56 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round" strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 0.8, ease: 'easeOut' }} />
    </svg>
  );
}

function TickerLogo({ ticker }) {
  const [err, setErr] = useState(false);
  const symbol = ticker?.replace(/_[A-Z]+_EQ$/, '').replace(/_[A-Z]+$/, '');
  if (err) {
    const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'];
    const c = colors[symbol?.charCodeAt(0) % colors.length] || '#3b82f6';
    return <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c}22`, border: `1px solid ${c}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: c, flexShrink: 0 }}>{symbol?.slice(0,3)}</div>;
  }
  return <img src={`https://assets.parqet.com/logos/symbol/${symbol}?format=png`} alt={symbol} onError={() => setErr(true)} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', background: 'rgba(255,255,255,0.05)', padding: 3, flexShrink: 0 }} />;
}

function AnalysisCard({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const sig = item.signal || (item.outlook === 'BULLISH' ? 'BUY' : item.outlook === 'BEARISH' ? 'SELL' : 'HOLD');
  const cfg = SIGNAL_CONFIG[sig] || SIGNAL_CONFIG['HOLD'];
  const outlookColor = OUTLOOK_COLOR[item.outlook] || '#3b82f6';
  const pnlPct = item.averagePrice > 0 && item.currentPrice ? ((item.currentPrice - item.averagePrice) / item.averagePrice * 100) : (item.ppl || 0);
  const pnlPos = pnlPct >= 0;
  const ticker = (item.ticker || '').replace(/_[A-Z]+_EQ$/, '').replace(/_[A-Z]+$/, '');
  const targetDiff = item.targetPrice && item.currentPrice ? ((item.targetPrice - item.currentPrice) / item.currentPrice * 100) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.border; e.currentTarget.style.boxShadow = `0 0 24px ${cfg.glow}`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
      onClick={() => setExpanded(x => !x)}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${cfg.color}00, ${cfg.color}, ${cfg.color}00)` }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <TickerLogo ticker={item.ticker} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>{ticker}</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{item.fullName || ticker}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', boxShadow: `0 0 12px ${cfg.glow}` }}>{sig}</span>
              <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 10, background: item.source === 'groq' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.1)', color: item.source === 'groq' ? '#a78bfa' : '#60a5fa', fontWeight: 600, letterSpacing: '0.05em' }}>{item.source === 'groq' ? 'AI' : 'MATH'}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ConfidenceRing pct={item.confidence || 0} color={outlookColor} size={52} />
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: outlookColor }}>{item.confidence || 0}%</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Outlook</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: outlookColor }}>{item.outlook || 'NEUTRAL'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: item.riskLevel === 'HIGH' ? 'rgba(239,68,68,0.12)' : item.riskLevel === 'LOW' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: item.riskLevel === 'HIGH' ? '#ef4444' : item.riskLevel === 'LOW' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{item.riskLevel || 'MEDIUM'} RISK</span>
          </div>
        </div>
        {targetDiff !== null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Target</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: targetDiff >= 0 ? '#10b981' : '#ef4444' }}>
              {targetDiff >= 0 ? '+' : ''}{targetDiff.toFixed(1)}%
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#64748b' }}>${item.targetPrice?.toFixed(2)}</div>
          </div>
        )}
      </div>

      {item.keyReason && <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, fontStyle: 'italic', marginBottom: 12 }}>"{item.keyReason}"</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: pnlPos ? '#10b981' : '#ef4444', fontWeight: 600 }}>
            {pnlPos ? '+' : ''}{pnlPct.toFixed(2)}% P&L
          </span>
          {item.currentPrice && <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#475569' }}>@ £{item.currentPrice?.toFixed(2)}</span>}
        </div>
        <span style={{ fontSize: 11, color: '#3b82f6' }}>{expanded ? 'Less ▲' : 'More ▼'}</span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ paddingTop: 14 }}>
              {item.catalysts?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Catalysts</div>
                  {item.catalysts.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                      <CheckCircle size={12} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} /> {c}
                    </div>
                  ))}
                </div>
              )}
              {item.risks?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Risks</div>
                  {item.risks.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                      <XCircle size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} /> {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Predictions() {
  const [analysis, setAnalysis] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signalFilter, setSignalFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('confidence');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const [analysisRes, statusRes] = await Promise.all([
        axios.get(`${BASE}/analysis`),
        axios.get(`${BASE}/analysis/status`).catch(() => ({ data: {} })),
      ]);
      setAnalysis(Array.isArray(analysisRes.data) ? analysisRes.data : []);
      setStatus(statusRes.data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Analysis fetch failed:', e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  const refresh = async () => {
    setRefreshing(true);
    await axios.post(`${BASE}/analysis/refresh`).catch(() => {});
    await fetchAnalysis();
    setRefreshing(false);
  };

  const signals = ['ALL', 'STRONG BUY', 'BUY', 'HOLD', 'SELL', 'STRONG SELL'];
  const sorted = [...analysis].sort((a, b) => {
    if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0);
    if (sortBy === 'signal') return (SIGNAL_CONFIG[a.signal]?.order ?? 2) - (SIGNAL_CONFIG[b.signal]?.order ?? 2);
    if (sortBy === 'pnl') {
      const aPnl = a.averagePrice > 0 ? ((a.currentPrice - a.averagePrice) / a.averagePrice * 100) : 0;
      const bPnl = b.averagePrice > 0 ? ((b.currentPrice - b.averagePrice) / b.averagePrice * 100) : 0;
      return bPnl - aPnl;
    }
    return (a.ticker || '').localeCompare(b.ticker || '');
  });

  const filtered = signalFilter === 'ALL' ? sorted : sorted.filter(a => (a.signal || (a.outlook === 'BULLISH' ? 'BUY' : a.outlook === 'BEARISH' ? 'SELL' : 'HOLD')) === signalFilter);

  const bullish = analysis.filter(a => a.outlook === 'BULLISH').length;
  const bearish = analysis.filter(a => a.outlook === 'BEARISH').length;
  const majority = bullish > analysis.length / 2 ? 'BULLISH' : bearish > analysis.length / 2 ? 'BEARISH' : 'NEUTRAL';
  const avgConf = analysis.length ? Math.round(analysis.reduce((s, a) => s + (a.confidence || 0), 0) / analysis.length) : 0;
  const majorityColor = OUTLOOK_COLOR[majority] || '#3b82f6';

  const signalCounts = analysis.reduce((acc, a) => {
    const sig = a.signal || (a.outlook === 'BULLISH' ? 'BUY' : a.outlook === 'BEARISH' ? 'SELL' : 'HOLD');
    acc[sig] = (acc[sig] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brain size={20} color="#3b82f6" /> AI Predictions
          </h2>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {status?.hasGroq ? `Powered by Llama 3.3 70B via Groq` : 'Rule-based analysis (add Groq key for AI)'} · Not financial advice
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: status?.hasGroq ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${status?.hasGroq ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, fontSize: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: status?.hasGroq ? '#10b981' : '#f59e0b' }} />
            <span style={{ color: status?.hasGroq ? '#10b981' : '#f59e0b', fontWeight: 500 }}>{status?.hasGroq ? 'Groq Connected' : 'No API Key'}</span>
          </div>
          <button onClick={refresh} disabled={refreshing || loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', fontSize: 12, fontWeight: 500, cursor: (refreshing || loading) ? 'default' : 'pointer', opacity: (refreshing || loading) ? 0.6 : 1 }}>
            <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
      </div>

      {!status?.hasGroq && (
        <div style={{ padding: '14px 18px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94a3b8' }}>
            <Zap size={14} color="#3b82f6" />
            <span>Add your free Groq API key to enable AI-powered analysis via Llama 3.3 70B</span>
          </div>
          <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, padding: '5px 12px', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, whiteSpace: 'nowrap' }}>Get Free Key →</a>
        </div>
      )}

      {!loading && analysis.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.06))', border: `1px solid ${majorityColor}25`, borderRadius: 18, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, background: `radial-gradient(circle, ${majorityColor}12, transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Portfolio Outlook</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: majorityColor, lineHeight: 1 }}>{majority}</div>
              {lastUpdated && <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>Updated {lastUpdated.toLocaleTimeString()}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ConfidenceRing pct={avgConf} color={majorityColor} size={70} />
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{avgConf}%</div>
                <div style={{ fontSize: 11, color: '#475569' }}>Avg confidence</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginLeft: 'auto' }}>
              {[['Bullish', bullish, '#10b981'], ['Neutral', analysis.length - bullish - bearish, '#3b82f6'], ['Bearish', bearish, '#ef4444']].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {Object.keys(signalCounts).length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(signalCounts).sort((a,b) => (SIGNAL_CONFIG[a[0]]?.order ?? 2) - (SIGNAL_CONFIG[b[0]]?.order ?? 2)).map(([sig, cnt]) => {
                const cfg = SIGNAL_CONFIG[sig] || SIGNAL_CONFIG['HOLD'];
                return (
                  <button key={sig} onClick={() => setSignalFilter(signalFilter === sig ? 'ALL' : sig)}
                    style={{ padding: '4px 12px', borderRadius: 20, background: signalFilter === sig ? cfg.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${signalFilter === sig ? cfg.border : 'rgba(255,255,255,0.08)'}`, color: cfg.color, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {cnt} {sig}
                  </button>
                );
              })}
              {signalFilter !== 'ALL' && <button onClick={() => setSignalFilter('ALL')} style={{ padding: '4px 10px', borderRadius: 20, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#475569', fontSize: 11, cursor: 'pointer' }}>Clear</button>}
            </div>
          )}
        </motion.div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#475569' }}>{filtered.length} position{filtered.length !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#475569' }}>Sort:</span>
          {[['confidence','Confidence'],['signal','Signal'],['pnl','P&L'],['ticker','Ticker']].map(([v,l]) => (
            <button key={v} onClick={() => setSortBy(v)}
              style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${sortBy === v ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, background: sortBy === v ? 'rgba(59,130,246,0.12)' : 'transparent', color: sortBy === v ? '#3b82f6' : '#475569', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[0,1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 200, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '600px 100%', animation: 'shimmer 1.6s ease-in-out infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#475569', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
          <Brain size={40} style={{ marginBottom: 16, opacity: 0.3, display: 'block', margin: '0 auto 16px' }} />
          <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>No analysis available</div>
          <div style={{ fontSize: 12 }}>Click Refresh All to generate predictions.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map((item, i) => <AnalysisCard key={item.ticker} item={item} index={i} />)}
        </div>
      )}
    </div>
  );
}
