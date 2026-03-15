import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Target, Shield, Zap, Globe } from 'lucide-react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { usePortfolio } from '../hooks/useApi';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5002';

// Helper functions
const fmtMoney = (n, prefix='£') => {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const s = abs >= 1000 ? abs.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : abs.toFixed(2);
  return (n < 0 ? '-' : '') + prefix + s;
};
const fmtPct = (n) => n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const sigColor = (s) => ({ 'STRONG BUY': '#10b981', 'BUY': '#22d3ee', 'HOLD': '#f59e0b', 'SELL': '#f97316', 'STRONG SELL': '#ef4444' }[s] || '#94a3b8');
const riskColor = (r) => ({ HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' }[r] || '#94a3b8');

function SignalBadge({ signal, confidence, size='sm' }) {
  const color = sigColor(signal);
  const pad = size === 'lg' ? '6px 14px' : '3px 9px';
  const fs = size === 'lg' ? 13 : 11;
  return (
    <span style={{ padding: pad, borderRadius: 6, background: color + '20', border: `1px solid ${color}50`, color, fontSize: fs, fontWeight: 700, fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap' }}>
      {signal}{confidence != null ? ` ${confidence}%` : ''}
    </span>
  );
}

function ConfBar({ value, color = '#3b82f6' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: value + '%', height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono', minWidth: 28 }}>{value}%</span>
    </div>
  );
}

function EvidenceRow({ e }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' }}>
      <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 1 }}>{e.type}</span>
      <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{e.fact}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap' }}>+{e.weight}</span>
    </div>
  );
}

function PositionRow({ d, onExpand, expanded }) {
  const sig = d.signal;
  const color = sigColor(sig);
  const pos = d.position;
  const pnl = pos?.ppl ?? 0;
  const pnlPct = pos?.pplPercentage ?? 0;
  const dayChg = d.price?.changePercent;

  return (
    <>
      <tr
        onClick={() => onExpand(d.ticker)}
        style={{ cursor: 'pointer', borderLeft: `3px solid ${color}`, background: expanded ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#f1f5f9', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={`https://assets.parqet.com/logos/symbol/${d.ticker}?format=svg`} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} onError={e => { e.target.style.display = 'none'; }} />
            {d.ticker}
          </div>
        </td>
        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: '#f1f5f9' }}>{d.price?.price ? '£' + d.price.price.toFixed(2) : '—'}</td>
        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: dayChg >= 0 ? '#10b981' : '#ef4444' }}>
          {dayChg != null ? (dayChg >= 0 ? '+' : '') + dayChg.toFixed(2) + '%' : '—'}
        </td>
        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>
          {pnl >= 0 ? '+' : ''}£{Math.abs(pnl).toFixed(0)}
        </td>
        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: pnlPct >= 0 ? '#10b981' : '#ef4444' }}>
          {pnlPct >= 0 ? '+' : ''}{pnlPct?.toFixed(1)}%
        </td>
        <td style={{ padding: '10px 8px' }}><SignalBadge signal={sig} /></td>
        <td style={{ padding: '10px 8px', minWidth: 100 }}><ConfBar value={d.confidence} color={color} /></td>
        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 11, color: d.rsi < 30 ? '#10b981' : d.rsi > 70 ? '#ef4444' : '#94a3b8' }}>
          {d.rsi?.toFixed(0) || '—'}
        </td>
        <td style={{ padding: '10px 8px', fontSize: 11, color: d.trend?.includes('UP') ? '#10b981' : d.trend?.includes('DOWN') ? '#ef4444' : '#94a3b8' }}>
          {d.trend?.replace('_', ' ') || '—'}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12, color: '#f1f5f9', fontWeight: 500 }}>{d.derivedAction || d.action}</td>
        <td style={{ padding: '10px 8px', color: '#64748b' }}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={11} style={{ padding: '0 12px 16px 20px', background: 'rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, paddingTop: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 8, letterSpacing: 1 }}>BULL CASE</div>
                {d.bullEvidence?.map((e, i) => <EvidenceRow key={i} e={e} />)}
                {!d.bullEvidence?.length && <div style={{ fontSize: 12, color: '#475569' }}>No bullish signals</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 8, letterSpacing: 1 }}>BEAR CASE</div>
                {d.bearEvidence?.map((e, i) => <EvidenceRow key={i} e={e} />)}
                {!d.bearEvidence?.length && <div style={{ fontSize: 12, color: '#475569' }}>No bearish signals</div>}
              </div>
            </div>
            {(d.targets?.support || d.targets?.resistance || d.targets?.analystTarget) && (
              <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                {d.targets.stopLoss && <span style={{ fontSize: 12, color: '#ef4444' }}>Stop: ${d.targets.stopLoss?.toFixed(2)}</span>}
                {d.targets.support && <span style={{ fontSize: 12, color: '#94a3b8' }}>Support: ${d.targets.support?.toFixed(2)}</span>}
                {d.targets.resistance && <span style={{ fontSize: 12, color: '#94a3b8' }}>Resistance: ${d.targets.resistance?.toFixed(2)}</span>}
                {d.targets.analystTarget && <span style={{ fontSize: 12, color: '#3b82f6' }}>Analyst target: ${d.targets.analystTarget?.toFixed(2)}</span>}
                {d.targets.riskReward && <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>R/R: {d.targets.riskReward}:1</span>}
              </div>
            )}
            {d.riskFactors?.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {d.riskFactors.map((r, i) => (
                  <span key={i} style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: 11 }}>⚠ {r}</span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function MarketTopbar({ macro, portfolio, pData }) {
  const { nyseOpen, lseOpen } = macro?.marketStatus || {};
  const totalVal = pData?.totalValue;
  const dayPnl = pData?.unrealizedPnl;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, marginBottom: 24, borderRadius: '12px 12px 0 0', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ fontFamily: 'JetBrains Mono', display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{totalVal ? '£' + totalVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span>
        {dayPnl != null && <span style={{ color: dayPnl >= 0 ? '#10b981' : '#ef4444' }}>{dayPnl >= 0 ? '+' : ''}£{Math.abs(dayPnl).toFixed(2)} today</span>}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ padding: '3px 8px', borderRadius: 4, background: nyseOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', color: nyseOpen ? '#10b981' : '#ef4444', fontWeight: 600 }}>NYSE {nyseOpen ? 'OPEN' : 'CLOSED'}</span>
        <span style={{ padding: '3px 8px', borderRadius: 4, background: lseOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', color: lseOpen ? '#10b981' : '#ef4444', fontWeight: 600 }}>LSE {lseOpen ? 'OPEN' : 'CLOSED'}</span>
        {macro?.vix?.value && <span style={{ color: '#94a3b8' }}>VIX <span style={{ color: macro.vix.value > 25 ? '#f59e0b' : '#f1f5f9', fontWeight: 600 }}>{macro.vix.value.toFixed(1)}</span></span>}
        {macro?.fearGreed?.score != null && <span style={{ color: '#94a3b8' }}>Fear/Greed <span style={{ color: macro.fearGreed.score < 30 ? '#ef4444' : macro.fearGreed.score > 70 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{macro.fearGreed.score}</span></span>}
        <span style={{ color: '#475569' }}>{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
}

function OpportunityCard({ ticker, signal, confidence, bullEvidence, bearEvidence, targets, trend }) {
  const color = sigColor(signal);
  return (
    <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}25`, borderRadius: 10, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <img src={`https://assets.parqet.com/logos/symbol/${ticker}?format=svg`} alt="" style={{ width: 22, height: 22, borderRadius: 4 }} onError={e => { e.target.style.display = 'none'; }} />
        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{ticker}</span>
        <SignalBadge signal={signal} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>{trend?.replace('_', ' ')}</span>
      </div>
      <ConfBar value={confidence} color={color} />
      <div style={{ marginTop: 10 }}>
        {bullEvidence?.slice(0, 2).map((e, i) => (
          <div key={i} style={{ fontSize: 11, color: '#10b981', marginBottom: 3 }}>✓ {e.fact}</div>
        ))}
        {bearEvidence?.slice(0, 1).map((e, i) => (
          <div key={i} style={{ fontSize: 11, color: '#f59e0b', marginBottom: 3 }}>⚠ {e.fact}</div>
        ))}
      </div>
      {(targets?.support || targets?.resistance) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, fontFamily: 'JetBrains Mono', color: '#64748b' }}>
          {targets.stopLoss && <span>Stop: ${targets.stopLoss?.toFixed(2)}</span>}
          {targets.resistance && <span>Target: ${targets.resistance?.toFixed(2)}</span>}
          {targets.riskReward && <span style={{ color: '#f59e0b' }}>R/R {targets.riskReward}:1</span>}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: pData, loading: pLoading } = usePortfolio();
  const [portfolio, setPortfolio] = useState(null);
  const [macro, setMacro] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [congress, setCongress] = useState([]);
  const [expandedTicker, setExpandedTicker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [portR, macroR, earnR, congR] = await Promise.allSettled([
      axios.get(API + '/api/decisions/portfolio'),
      axios.get(API + '/api/decisions/macro'),
      axios.get(API + '/api/earnings/today'),
      axios.get(API + '/api/congress?limit=5'),
    ]);
    if (portR.status === 'fulfilled') setPortfolio(portR.value.data);
    if (macroR.status === 'fulfilled') setMacro(macroR.value.data.macro);
    if (earnR.status === 'fulfilled') setEarnings(earnR.value.data?.data || []);
    if (congR.status === 'fulfilled') setCongress(congR.value.data?.trades || []);
    setLoading(false);

    // Load strong buy opportunities from screener
    try {
      const r = await axios.get(API + '/api/decisions/screener/strong_buy');
      const top3 = (r.data.results || []).slice(0, 6);
      const sigs = await Promise.all(top3.map(t => axios.get(API + '/api/decisions/' + t.ticker).then(r => r.data).catch(() => null)));
      setOpportunities(sigs.filter(Boolean).slice(0, 3));
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await axios.post(API + '/api/decisions/portfolio/refresh').catch(() => {});
    await load();
    setRefreshing(false);
  };

  const summary = portfolio?.summary;
  const decisions = (portfolio?.decisions || []).sort((a, b) => {
    const order = { 'STRONG SELL': 0, 'SELL': 1, 'HOLD': 2, 'BUY': 3, 'STRONG BUY': 4 };
    return (order[a.signal] ?? 2) - (order[b.signal] ?? 2);
  });

  const card = (children, extra = {}) => ({
    padding: '20px 22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, ...extra
  });

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* Top status bar */}
      <MarketTopbar macro={macro} portfolio={portfolio} pData={pData} />

      {/* SECTION 1: Portfolio Command Center */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Left: Portfolio stats */}
        <div style={card({})}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 14 }}>PORTFOLIO VALUE</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 32, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
            {pData?.totalValue ? '£' + pData.totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
            {[
              { label: 'Unrealised P&L', val: pData?.unrealizedPnl, pct: null, prefix: '£' },
              { label: 'Total Return', val: pData?.returnPct, pct: true, prefix: '' },
              { label: 'Cash Available', val: pData?.availableCash, pct: null, prefix: '£' },
            ].map(({ label, val, pct, prefix }) => (
              <div key={label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 600, color: val >= 0 ? '#10b981' : '#ef4444' }}>
                  {val != null ? (val >= 0 ? '+' : '') + prefix + Math.abs(val).toFixed(2) + (pct ? '%' : '') : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Portfolio decision */}
        <div style={card({ borderLeft: summary ? `3px solid ${summary.overallAction === 'REDUCE RISK' ? '#ef4444' : '#3b82f6'}` : undefined })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1 }}>PORTFOLIO INTELLIGENCE</div>
            <button onClick={handleRefresh} disabled={refreshing} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
          </div>
          {loading ? (
            <div style={{ color: '#475569', fontSize: 13 }}>Analysing portfolio...</div>
          ) : summary ? (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 14px', borderRadius: 8, background: summary.overallAction === 'REDUCE RISK' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.12)', color: summary.overallAction === 'REDUCE RISK' ? '#ef4444' : '#3b82f6', fontSize: 13, fontWeight: 700 }}>
                  {summary.overallAction}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>Avg confidence: <span style={{ color: '#f1f5f9', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{summary.avgConfidence}%</span></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Strong Buys', val: summary.strongBuys, color: '#10b981' },
                  { label: 'Strong Sells', val: summary.strongSells, color: '#ef4444' },
                  { label: 'High Risk', val: summary.highRiskPositions, color: '#f59e0b' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 24, fontWeight: 700, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
              {summary.attentionNeeded?.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginBottom: 6 }}>⚠ NEEDS ATTENTION</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {summary.attentionNeeded.map(a => (
                      <span key={a.ticker} style={{ fontSize: 12, color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}>
                        {a.ticker} <span style={{ color: sigColor(a.signal) }}>{a.signal}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : <div style={{ color: '#475569', fontSize: 13 }}>No portfolio data</div>}
        </div>
      </div>

      {/* SECTION 2: Positions Command Table */}
      <div style={card({ marginBottom: 20, padding: 0, overflow: 'hidden' })}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Positions</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>Click row for evidence · sorted by signal priority</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                {['Ticker', 'Price', 'Day%', 'P&L £', 'P&L%', 'Signal', 'Confidence', 'RSI', 'Trend', 'Action', ''].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 1, whiteSpace: 'nowrap', ...(h === 'Ticker' ? { paddingLeft: 12 } : {}) }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {decisions.length === 0 && !loading ? (
                <tr><td colSpan={11} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>No positions found</td></tr>
              ) : decisions.map(d => (
                <PositionRow
                  key={d.ticker}
                  d={d}
                  expanded={expandedTicker === d.ticker}
                  onExpand={t => setExpandedTicker(expandedTicker === t ? null : t)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Three column intel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Col 1: Market Pulse */}
        <div style={card({})}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 14 }}>MARKET PULSE</div>
          {macro ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>VIX</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: macro.vix?.value > 30 ? '#ef4444' : macro.vix?.value > 20 ? '#f59e0b' : '#10b981' }}>
                  {macro.vix?.value?.toFixed(1) || '—'} <span style={{ fontSize: 10, color: '#64748b' }}>{macro.vix?.value > 30 ? 'FEAR' : macro.vix?.value > 20 ? 'ELEVATED' : 'CALM'}</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Fear & Greed</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: macro.fearGreed?.score < 30 ? '#ef4444' : macro.fearGreed?.score > 70 ? '#10b981' : '#f59e0b' }}>
                  {macro.fearGreed?.score ?? '—'}/100
                  <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>{macro.fearGreed?.rating?.toUpperCase()}</span>
                </span>
              </div>
            </>
          ) : <div style={{ color: '#475569', fontSize: 12 }}>Loading macro data...</div>}
        </div>

        {/* Col 2: Upcoming catalysts */}
        <div style={card({})}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 14 }}>UPCOMING CATALYSTS</div>
          {earnings.slice(0, 5).map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#3b82f6' }}>{e.ticker}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{e.report_time}</span>
              {e.ai_signal && <SignalBadge signal={e.ai_signal} />}
            </div>
          ))}
          {earnings.length === 0 && <div style={{ fontSize: 12, color: '#475569' }}>No earnings today</div>}
        </div>

        {/* Col 3: Smart alerts (congress) */}
        <div style={card({})}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 14 }}>RECENT CONGRESS ACTIVITY</div>
          {congress.slice(0, 5).map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#f1f5f9', marginRight: 8 }}>{t.ticker}</span>
                <span style={{ fontSize: 10, color: t.party === 'D' ? '#3b82f6' : '#ef4444' }}>{t.party}</span>
              </div>
              <span style={{ fontSize: 11, color: t.transaction_type?.toLowerCase().includes('purchase') ? '#10b981' : '#ef4444' }}>
                {t.transaction_type?.toLowerCase().includes('purchase') ? 'BUY' : 'SELL'}
              </span>
            </div>
          ))}
          {congress.length === 0 && <div style={{ fontSize: 12, color: '#475569' }}>No recent activity</div>}
        </div>
      </div>

      {/* SECTION 4: Opportunity Scanner */}
      <div style={card({ marginBottom: 20 })}>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 16 }}>HIGH CONVICTION OPPORTUNITIES</div>
        {opportunities.length === 0 ? (
          <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: 24 }}>Scanning for opportunities...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {opportunities.map(o => <OpportunityCard key={o.ticker} {...o} />)}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
