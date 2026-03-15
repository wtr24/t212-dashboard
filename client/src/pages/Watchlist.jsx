import { useState, useEffect, useCallback } from 'react';
import { Eye, Plus, X, RefreshCw, ChevronDown, ChevronUp, Search, Bell } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5002';
const STORAGE_KEY = 't212_watchlist';

const sigColor = (s) => ({ 'STRONG BUY': '#10b981', 'BUY': '#22d3ee', 'HOLD': '#f59e0b', 'SELL': '#f97316', 'STRONG SELL': '#ef4444' }[s] || '#94a3b8');

function SignalBadge({ signal }) {
  const c = sigColor(signal);
  return <span style={{ padding: '2px 8px', borderRadius: 5, background: c + '20', border: `1px solid ${c}40`, color: c, fontSize: 11, fontWeight: 700 }}>{signal}</span>;
}

function EvidencePanel({ d }) {
  return (
    <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 8, letterSpacing: 1 }}>BULL CASE</div>
        {d.bullEvidence?.slice(0, 4).map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(16,185,129,0.1)', color: '#10b981', whiteSpace: 'nowrap' }}>{e.type}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{e.fact}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 8, letterSpacing: 1 }}>BEAR CASE</div>
        {d.bearEvidence?.slice(0, 4).map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444', whiteSpace: 'nowrap' }}>{e.type}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{e.fact}</span>
          </div>
        ))}
      </div>
      {(d.targets?.support || d.targets?.resistance) && (
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 16, fontSize: 12, fontFamily: 'JetBrains Mono', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {d.targets.stopLoss && <span style={{ color: '#ef4444' }}>Stop ${d.targets.stopLoss?.toFixed(2)}</span>}
          {d.targets.support && <span style={{ color: '#94a3b8' }}>Support ${d.targets.support?.toFixed(2)}</span>}
          {d.targets.resistance && <span style={{ color: '#94a3b8' }}>Resistance ${d.targets.resistance?.toFixed(2)}</span>}
          {d.targets.analystTarget && <span style={{ color: '#3b82f6' }}>Target ${d.targets.analystTarget?.toFixed(2)}</span>}
          {d.targets.riskReward && <span style={{ color: '#f59e0b', fontWeight: 700 }}>R/R {d.targets.riskReward}:1</span>}
        </div>
      )}
      {d.riskFactors?.length > 0 && (
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {d.riskFactors.map((r, i) => <span key={i} style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11 }}>⚠ {r}</span>)}
        </div>
      )}
    </div>
  );
}

function WatchlistRow({ ticker, signal, expanded, onExpand, onRemove, earnings }) {
  const sig = signal;
  const color = sig ? sigColor(sig.signal) : '#64748b';
  const daysUntilEarnings = earnings ? Math.ceil((new Date(earnings.report_date) - new Date()) / 86400000) : null;

  return (
    <>
      <tr
        onClick={() => onExpand(ticker)}
        style={{ cursor: 'pointer', borderLeft: `3px solid ${color}`, borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s', background: expanded ? 'rgba(255,255,255,0.05)' : 'transparent' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#f1f5f9', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={`https://assets.parqet.com/logos/symbol/${ticker}?format=svg`} alt="" style={{ width: 22, height: 22, borderRadius: 4 }} onError={e => { e.target.style.display = 'none'; }} />
            {ticker}
          </div>
        </td>
        <td style={{ padding: '12px 8px', fontFamily: 'JetBrains Mono', fontSize: 13, color: '#f1f5f9' }}>
          {sig?.price?.price ? '$' + sig.price.price.toFixed(2) : '—'}
        </td>
        <td style={{ padding: '12px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: (sig?.price?.changePercent || 0) >= 0 ? '#10b981' : '#ef4444' }}>
          {sig?.price?.changePercent != null ? (sig.price.changePercent >= 0 ? '+' : '') + sig.price.changePercent.toFixed(2) + '%' : '—'}
        </td>
        <td style={{ padding: '12px 8px' }}>{sig ? <SignalBadge signal={sig.signal} /> : <span style={{ color: '#64748b', fontSize: 12 }}>Loading…</span>}</td>
        <td style={{ padding: '12px 8px' }}>
          {sig && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, minWidth: 60 }}>
                <div style={{ width: (sig.confidence || 0) + '%', height: '100%', background: color, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: '#94a3b8' }}>{sig.confidence}%</span>
            </div>
          )}
        </td>
        <td style={{ padding: '12px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: sig?.rsi < 30 ? '#10b981' : sig?.rsi > 70 ? '#ef4444' : '#94a3b8' }}>
          {sig?.rsi?.toFixed(0) || '—'}
        </td>
        <td style={{ padding: '12px 8px', fontSize: 11, color: sig?.trend?.includes('UP') ? '#10b981' : sig?.trend?.includes('DOWN') ? '#ef4444' : '#94a3b8' }}>
          {sig?.trend?.replace('_', ' ') || '—'}
        </td>
        <td style={{ padding: '12px 8px' }}>
          {daysUntilEarnings != null && daysUntilEarnings >= 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 10, background: daysUntilEarnings <= 7 ? 'rgba(239,68,68,0.15)' : daysUntilEarnings <= 14 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.1)', color: daysUntilEarnings <= 7 ? '#ef4444' : daysUntilEarnings <= 14 ? '#f59e0b' : '#10b981', fontSize: 11, fontWeight: 600 }}>
              {daysUntilEarnings}d
            </span>
          )}
        </td>
        <td style={{ padding: '12px 8px', fontSize: 12, color: '#f1f5f9', fontWeight: 500 }}>{sig?.action || '—'}</td>
        <td style={{ padding: '12px 8px', color: '#475569', display: 'flex', gap: 8, alignItems: 'center' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <button onClick={e => { e.stopPropagation(); onRemove(ticker); }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}>
            <X size={13} />
          </button>
        </td>
      </tr>
      {expanded && sig && <tr><td colSpan={10}><EvidencePanel d={sig} /></td></tr>}
    </>
  );
}

export default function Watchlist() {
  const [tickers, setTickers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [signals, setSignals] = useState({});
  const [earnings, setEarnings] = useState({});
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const saveTickers = (t) => {
    setTickers(t);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  };

  const loadSignal = useCallback(async (ticker) => {
    try {
      const r = await axios.get(API + '/api/decisions/' + ticker);
      setSignals(prev => ({ ...prev, [ticker]: r.data }));
    } catch {}
  }, []);

  useEffect(() => {
    tickers.forEach(t => { if (!signals[t]) loadSignal(t); });
    // Load earnings
    tickers.forEach(async t => {
      try {
        const r = await axios.get(API + '/api/earnings/' + t);
        const upcoming = (r.data || []).find(e => e.eps_actual == null && new Date(e.report_date) >= new Date());
        if (upcoming) setEarnings(prev => ({ ...prev, [t]: upcoming }));
      } catch {}
    });
  }, [tickers]); // eslint-disable-line

  const addTicker = () => {
    const t = input.trim().toUpperCase();
    if (t && !tickers.includes(t)) {
      saveTickers([...tickers, t]);
      loadSignal(t);
    }
    setInput('');
  };

  const removeTicker = (t) => saveTickers(tickers.filter(x => x !== t));

  const runBulkAnalysis = async () => {
    setAnalyzing(true);
    await Promise.all(tickers.map(t => loadSignal(t)));
    setAnalyzing(false);
  };

  const sorted = [...tickers].sort((a, b) => {
    const order = { 'STRONG SELL': 0, 'SELL': 1, 'HOLD': 2, 'BUY': 3, 'STRONG BUY': 4 };
    const sa = signals[a]?.signal, sb = signals[b]?.signal;
    return (order[sb] ?? 2) - (order[sa] ?? 2);
  });

  const card = (extra = {}) => ({ padding: '20px 22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, ...extra });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eye size={20} color="#3b82f6" /> Watchlist
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 400 }}>({tickers.length})</span>
          </h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <input
              value={input} onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && addTicker()}
              placeholder="Add ticker…"
              style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'JetBrains Mono', width: 140 }}
            />
            <button onClick={addTicker} style={{ padding: '8px 14px', background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
              <Plus size={14} /> Add
            </button>
          </div>
          <button onClick={runBulkAnalysis} disabled={analyzing} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} style={{ animation: analyzing ? 'spin 1s linear infinite' : 'none' }} />
            {analyzing ? 'Analysing…' : 'Analyse All'}
          </button>
        </div>
      </div>

      {tickers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#475569' }}>
          <Eye size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: 16, marginBottom: 8 }}>Your watchlist is empty</div>
          <div style={{ fontSize: 13 }}>Add tickers above to track signals and opportunities</div>
        </div>
      ) : (
        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.4)' }}>
                  {['Ticker', 'Price', 'Day%', 'Signal', 'Confidence', 'RSI', 'Trend', 'Earnings', 'Action', ''].map(h => (
                    <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 1, whiteSpace: 'nowrap', ...(h === 'Ticker' ? { paddingLeft: 12 } : {}) }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <WatchlistRow key={t} ticker={t} signal={signals[t]} earnings={earnings[t]} expanded={expanded === t} onExpand={tk => setExpanded(expanded === tk ? null : tk)} onRemove={removeTicker} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
