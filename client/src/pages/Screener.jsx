import { useState, useEffect } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp, Play, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5002';
const sigColor = s => ({ 'STRONG BUY': '#10b981', 'BUY': '#22d3ee', 'HOLD': '#f59e0b', 'SELL': '#f97316', 'STRONG SELL': '#ef4444' }[s] || '#94a3b8');

const PRESETS = [
  { id: 'strong_buy', label: 'Highest Conviction Buys', icon: '🎯', rationale: 'Technical + fundamental agreement = highest win rate', edge: 'Multi-signal confirmation' },
  { id: 'oversold_quality', label: 'Oversold Quality', icon: '📉', rationale: 'Quality stocks at temporarily depressed prices', edge: 'Mean reversion + analyst support' },
  { id: 'golden_cross', label: 'Golden Cross Breakout', icon: '✨', rationale: 'Major technical event confirmed by volume', edge: 'Trend change signal' },
  { id: 'earnings_soon', label: 'Upcoming Earnings Plays', icon: '📅', rationale: 'AI-rated high beat probability before earnings', edge: 'Catalyst event trade' },
  { id: 'congress_buys', label: 'Congress Conviction', icon: '🏛️', rationale: 'Informed buyers at multiple levels', edge: 'Smart money flow' },
  { id: 'insider_buys', label: 'Insider Accumulation', icon: '👔', rationale: 'Insiders buying with own money is a strong signal', edge: 'Insider knowledge proxy' },
];

function SignalBadge({ signal }) {
  const c = sigColor(signal);
  return <span style={{ padding: '2px 8px', borderRadius: 5, background: c + '20', border: `1px solid ${c}40`, color: c, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{signal}</span>;
}

function EvidencePanel({ d }) {
  if (!d) return <td colSpan={10} style={{ padding: 24, textAlign: 'center' }}><span style={{ color: '#64748b', fontSize: 12 }}>Loading decision engine...</span></td>;
  return (
    <td colSpan={10} style={{ padding: '0' }}>
      <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 8, letterSpacing: 1 }}>BULL CASE</div>
          {d.bullEvidence?.slice(0, 4).map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(16,185,129,0.1)', color: '#10b981', whiteSpace: 'nowrap' }}>{e.type}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{e.fact}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono' }}>+{e.weight}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 8, letterSpacing: 1 }}>BEAR CASE</div>
          {d.bearEvidence?.slice(0, 4).map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444', whiteSpace: 'nowrap' }}>{e.type}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{e.fact}</span>
            </div>
          ))}
          {!d.bearEvidence?.length && <div style={{ fontSize: 12, color: '#475569' }}>No bearish signals</div>}
        </div>
        {(d.targets?.resistance || d.targets?.analystTarget) && (
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 16, fontSize: 12, fontFamily: 'JetBrains Mono', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {d.targets.stopLoss && <span style={{ color: '#ef4444' }}>Stop ${d.targets.stopLoss?.toFixed(2)}</span>}
            {d.targets.resistance && <span style={{ color: '#94a3b8' }}>Resistance ${d.targets.resistance?.toFixed(2)}</span>}
            {d.targets.analystTarget && <span style={{ color: '#3b82f6' }}>Analyst ${d.targets.analystTarget?.toFixed(2)}</span>}
            {d.targets.riskReward && <span style={{ color: '#f59e0b', fontWeight: 700 }}>R/R {d.targets.riskReward}:1</span>}
          </div>
        )}
      </div>
    </td>
  );
}

// Render a result row depending on preset type
function ResultRow({ row, preset, decision, expanded, onExpand }) {
  const color = decision ? sigColor(decision.signal) : '#64748b';
  const ticker = row.ticker?.toUpperCase();

  // Columns vary by preset, so render common + preset-specific columns
  const earnDays = row.report_date ? Math.ceil((new Date(row.report_date) - new Date()) / 86400000) : null;

  return (
    <>
      <tr
        onClick={() => onExpand(ticker)}
        style={{ cursor: 'pointer', borderLeft: `3px solid ${color}`, borderBottom: '1px solid rgba(255,255,255,0.04)', background: expanded ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.15s' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'JetBrains Mono', fontSize: 13, color: '#f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={`https://assets.parqet.com/logos/symbol/${ticker}?format=svg`} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} onError={e => { e.target.style.display = 'none'; }} />
            {ticker}
          </div>
        </td>
        {/* Price */}
        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: '#f1f5f9' }}>
          {decision?.price?.price ? '$' + decision.price.price.toFixed(2) : '—'}
        </td>
        {/* Preset-specific cell */}
        {preset === 'strong_buy' || preset === 'oversold_quality' || preset === 'golden_cross' ? (
          <>
            <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: '#94a3b8' }}>{row.technical_score || '—'}</td>
            <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: parseFloat(row.rsi_14) < 35 ? '#10b981' : parseFloat(row.rsi_14) > 70 ? '#ef4444' : '#94a3b8' }}>{row.rsi_14 ? parseFloat(row.rsi_14).toFixed(0) : '—'}</td>
            <td style={{ padding: '10px 8px', fontSize: 11, color: row.trend?.includes('UP') ? '#10b981' : row.trend?.includes('DOWN') ? '#ef4444' : '#94a3b8' }}>{row.trend?.replace(/_/g, ' ') || '—'}</td>
          </>
        ) : preset === 'earnings_soon' ? (
          <>
            <td style={{ padding: '10px 8px', fontSize: 12, color: '#f1f5f9' }}>{row.report_date ? new Date(row.report_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : '—'}</td>
            <td style={{ padding: '10px 8px', fontSize: 11, color: '#94a3b8' }}>{row.report_time || '—'}</td>
            <td style={{ padding: '10px 8px' }}>
              {row.ai_beat_probability != null && (
                <span style={{ padding: '2px 8px', borderRadius: 10, background: row.ai_beat_probability > 70 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)', color: row.ai_beat_probability > 70 ? '#10b981' : '#f59e0b', fontSize: 11, fontWeight: 700 }}>
                  {row.ai_beat_probability}% beat prob
                </span>
              )}
            </td>
          </>
        ) : preset === 'congress_buys' ? (
          <>
            <td style={{ padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>{row.member_name}</td>
            <td style={{ padding: '10px 8px', fontSize: 11 }}><span style={{ color: row.party === 'D' ? '#3b82f6' : '#ef4444', fontWeight: 700 }}>{row.party}</span></td>
            <td style={{ padding: '10px 8px', fontSize: 11, color: '#64748b' }}>{row.transaction_date ? new Date(row.transaction_date).toLocaleDateString('en-GB') : '—'}</td>
          </>
        ) : preset === 'insider_buys' ? (
          <>
            <td style={{ padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>{row.insider_name}</td>
            <td style={{ padding: '10px 8px', fontSize: 11, color: '#64748b' }}>{row.title}</td>
            <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: '#10b981' }}>
              {row.value ? '$' + (row.value / 1e6).toFixed(1) + 'M' : '—'}
            </td>
          </>
        ) : null}
        {/* Decision engine signal */}
        <td style={{ padding: '10px 8px' }}>{decision ? <SignalBadge signal={decision.signal} /> : <span style={{ fontSize: 11, color: '#475569' }}>—</span>}</td>
        <td style={{ padding: '10px 8px' }}>
          {decision && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 50, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <div style={{ width: decision.confidence + '%', height: '100%', background: color, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: '#94a3b8' }}>{decision.confidence}%</span>
            </div>
          )}
        </td>
        {/* WHY col */}
        <td style={{ padding: '10px 8px', fontSize: 11, color: '#94a3b8', maxWidth: 200 }}>
          {decision?.bullEvidence?.[0]?.fact || '—'}
        </td>
        <td style={{ padding: '10px 8px', color: '#475569' }}>{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</td>
      </tr>
      {expanded && <tr style={{ background: 'rgba(0,0,0,0.2)' }}><EvidencePanel d={decision} /></tr>}
    </>
  );
}

export default function Screener() {
  const [activePreset, setActivePreset] = useState(null);
  const [results, setResults] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const runPreset = async (preset) => {
    setActivePreset(preset);
    setLoading(true);
    setResults([]);
    setDecisions({});
    setExpanded(null);
    try {
      const r = await axios.get(API + '/api/decisions/screener/' + preset.id);
      const rows = r.data.results || [];
      setResults(rows);
      // Run decision engine on top 10
      const top10 = rows.slice(0, 10);
      await Promise.all(top10.map(async row => {
        const t = row.ticker?.toUpperCase();
        if (!t) return;
        try {
          const dr = await axios.get(API + '/api/decisions/' + t);
          setDecisions(prev => ({ ...prev, [t]: dr.data }));
        } catch {}
      }));
    } catch {}
    setLoading(false);
  };

  const card = (extra = {}) => ({ padding: '20px 22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, ...extra });

  // Header columns per preset
  const getColumns = (preset) => {
    const common = ['Ticker', 'Price'];
    const specific = {
      strong_buy: ['TA Score', 'RSI', 'Trend'],
      oversold_quality: ['TA Score', 'RSI', 'Trend'],
      golden_cross: ['TA Score', 'RSI', 'Trend'],
      earnings_soon: ['Date', 'Time', 'Beat Prob'],
      congress_buys: ['Member', 'Party', 'Date'],
      insider_buys: ['Insider', 'Title', 'Value'],
    };
    return [...common, ...(specific[preset] || []), 'Signal', 'Conf', 'Why It Matches', ''];
  };

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <SlidersHorizontal size={20} color="#3b82f6" /> Stock Screener
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Each screen has an edge — results show why they match with decision engine analysis</p>
      </div>

      {/* Preset grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => runPreset(p)}
            style={{ padding: '16px 18px', borderRadius: 12, background: activePreset?.id === p.id ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${activePreset?.id === p.id ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
            onMouseEnter={e => { if (activePreset?.id !== p.id) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { if (activePreset?.id !== p.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{p.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{p.label}</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{p.rationale}</div>
            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>Edge: {p.edge}</div>
          </button>
        ))}
      </div>

      {/* Results */}
      {activePreset && (
        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16 }}>{activePreset.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{activePreset.label}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{loading ? 'Running...' : `${results.length} results · decision engine running on top 10`}</span>
            {loading && <RefreshCw size={13} style={{ color: '#64748b', animation: 'spin 1s linear infinite', marginLeft: 4 }} />}
          </div>
          {results.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.4)' }}>
                    {getColumns(activePreset.id).map(h => (
                      <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 1, whiteSpace: 'nowrap', ...(h === 'Ticker' ? { paddingLeft: 12 } : {}) }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => {
                    const t = row.ticker?.toUpperCase();
                    return (
                      <ResultRow key={i} row={row} preset={activePreset.id} decision={decisions[t]} expanded={expanded === t} onExpand={tk => setExpanded(expanded === tk ? null : tk)} />
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>Running screen against database...</div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>No results found for this screen</div>
          )}
        </div>
      )}

      {!activePreset && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
          <SlidersHorizontal size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: 15 }}>Select a screen above to run it</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Results are live from the database with decision engine analysis</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
