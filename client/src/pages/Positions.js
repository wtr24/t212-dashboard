import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import OutlookBadge from '../components/OutlookBadge';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

const col = { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer', userSelect: 'none', padding: '12px 16px', whiteSpace: 'nowrap' };
const cell = { padding: '14px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' };

export default function Positions() {
  const { data: pos = [], loading } = useApi('/portfolio/positions');
  const [sortKey, setSortKey] = useState('ppl');
  const [sortDir, setSortDir] = useState(-1);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const sort = (key) => { setSortKey(key); setSortDir(k => sortKey === key ? -k : -1); };
  const sorted = [...pos]
    .filter(p => !search || p.ticker?.toLowerCase().includes(search.toLowerCase()) || p.fullName?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = sortKey === 'value' ? (a.currentPrice * a.quantity) : sortKey === 'pplPct' ? ((a.ppl || 0) / (a.averagePrice * a.quantity) * 100) : (a[sortKey] || 0);
      const bv = sortKey === 'value' ? (b.currentPrice * b.quantity) : sortKey === 'pplPct' ? ((b.ppl || 0) / (b.averagePrice * b.quantity) * 100) : (b[sortKey] || 0);
      return (bv - av) * sortDir;
    });

  const SortIcon = ({ k }) => sortKey === k ? (sortDir === -1 ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null;

  if (loading) return <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Loading positions...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Positions <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 14 }}>({sorted.length})</span></h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
          <Search size={14} color="var(--muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, width: 140 }} />
        </div>
      </div>
      <div className="glass" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {[['ticker','Ticker'],['quantity','Qty'],['averagePrice','Avg Cost'],['currentPrice','Price'],['ppl','P&L £'],['pplPct','P&L %'],['value','Value']].map(([k,l]) => (
                <th key={k} style={col} onClick={() => sort(k)}>{l} <SortIcon k={k} /></th>
              ))}
              <th style={col}>AI</th>
              <th style={col}>Sentiment</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const pplPct = p.averagePrice > 0 ? (p.ppl / (p.averagePrice * p.quantity)) * 100 : 0;
              const value = p.currentPrice * p.quantity;
              const isPos = (p.ppl || 0) >= 0;
              const isExp = expanded === p.ticker;
              return (
                <>
                  <motion.tr key={p.ticker} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    onClick={() => setExpanded(isExp ? null : p.ticker)}
                    style={{ cursor: 'pointer', background: isExp ? 'rgba(0,255,136,0.03)' : 'transparent', transition: 'background 0.15s' }}>
                    <td style={{ ...cell, fontWeight: 700 }}>{p.ticker}</td>
                    <td style={{ ...cell }} className="mono">{(p.quantity || 0).toFixed(4)}</td>
                    <td style={{ ...cell }} className="mono">£{(p.averagePrice || 0).toFixed(2)}</td>
                    <td style={{ ...cell }} className="mono">£{(p.currentPrice || 0).toFixed(2)}</td>
                    <td style={{ ...cell, color: isPos ? 'var(--accent)' : 'var(--danger)' }} className="mono">{isPos ? '+' : ''}£{(p.ppl || 0).toFixed(2)}</td>
                    <td style={{ ...cell, color: isPos ? 'var(--accent)' : 'var(--danger)' }} className="mono">{isPos ? '+' : ''}{pplPct.toFixed(2)}%</td>
                    <td style={{ ...cell }} className="mono">£{value.toFixed(2)}</td>
                    <td style={cell}><OutlookBadge outlook={p.analysis?.outlook} /></td>
                    <td style={cell}>
                      {p.sentiment && (
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <div style={{ width: 40, height: 4, borderRadius: 2, background: `linear-gradient(to right, var(--accent) ${p.sentiment.bullish_pct}%, var(--danger) ${p.sentiment.bullish_pct}%)` }} />
                          <span style={{ fontSize: 10, color: 'var(--muted)' }} className="mono">{p.sentiment.bullish_pct}%</span>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {isExp && (
                      <motion.tr key={`${p.ticker}-exp`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <td colSpan={9} style={{ padding: 16, background: 'rgba(0,255,136,0.02)', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                            {p.analysis && (
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>AI ANALYSIS</div>
                                <OutlookBadge outlook={p.analysis.outlook} confidence={p.analysis.confidence} risk={p.analysis.risk_level} />
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, maxWidth: 300 }}>{p.analysis.reason}</div>
                              </div>
                            )}
                            {p.market && (
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>MARKET DATA</div>
                                <div className="mono" style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                                  <span style={{ color: 'var(--muted)' }}>52W High</span><span>£{(p.market.fiftyTwoWeekHigh||0).toFixed(2)}</span>
                                  <span style={{ color: 'var(--muted)' }}>52W Low</span><span>£{(p.market.fiftyTwoWeekLow||0).toFixed(2)}</span>
                                  <span style={{ color: 'var(--muted)' }}>Daily Chg</span><span style={{ color: (p.market.dailyChangePct||0) >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{(p.market.dailyChangePct||0).toFixed(2)}%</span>
                                </div>
                              </div>
                            )}
                            {p.sentiment && (
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>COMMUNITY</div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                  <span style={{ color: 'var(--accent)', fontSize: 13 }}>▲ {p.sentiment.bullish_pct}% Bullish</span>
                                  <span style={{ color: 'var(--danger)', fontSize: 13 }}>▼ {p.sentiment.bearish_pct}% Bearish</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
