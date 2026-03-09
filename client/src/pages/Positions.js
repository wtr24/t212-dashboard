import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import OutlookBadge from '../components/OutlookBadge';
import DataBanner from '../components/DataBanner';
import { SkeletonRow } from '../components/Skeleton';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

const col = { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', userSelect: 'none', padding: '12px 16px', whiteSpace: 'nowrap', background: 'var(--surface-2)' };
const cell = { padding: '14px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' };

export default function Positions() {
  const { data: raw, loading, refetch } = useApi('/portfolio/positions', { pollInterval: 60000 });
  const pos = raw?.positions || (Array.isArray(raw) ? raw : []);
  const [sortKey, setSortKey] = useState('ppl');
  const [sortDir, setSortDir] = useState(-1);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const sort = (key) => { setSortKey(key); setSortDir(k => sortKey === key ? -k : -1); };
  const sorted = [...pos]
    .filter(p => !search || p.ticker?.toLowerCase().includes(search.toLowerCase()) || p.fullName?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = sortKey === 'value' ? (a.currentPrice * a.quantity) : sortKey === 'pplPct' ? ((a.ppl || 0) / ((a.averagePrice || 1) * (a.quantity || 1)) * 100) : (a[sortKey] || 0);
      const bv = sortKey === 'value' ? (b.currentPrice * b.quantity) : sortKey === 'pplPct' ? ((b.ppl || 0) / ((b.averagePrice || 1) * (b.quantity || 1)) * 100) : (b[sortKey] || 0);
      return (bv - av) * sortDir;
    });

  const SortIcon = ({ k }) => sortKey === k ? (sortDir === -1 ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null;

  return (
    <div>
      <DataBanner source={raw?.source} age={raw?.age} onRefresh={refetch} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Positions <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 14 }}>({sorted.length})</span></h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 14px', boxShadow: 'var(--shadow)' }}>
          <Search size={14} color="var(--text-3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ticker or name..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, width: 180 }} />
        </div>
      </div>
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[['ticker','Ticker'],['quantity','Qty'],['averagePrice','Avg Cost'],['currentPrice','Price'],['ppl','P&L £'],['pplPct','P&L %'],['value','Value']].map(([k,l]) => (
                <th key={k} style={col} onClick={() => sort(k)}>{l} <SortIcon k={k} /></th>
              ))}
              <th style={col}>AI</th>
              <th style={col}>Sentiment</th>
            </tr>
          </thead>
          <tbody>
            {loading ? [0,1,2,3,4,5].map(i => <tr key={i}><td colSpan={9} style={{ padding: '12px 16px' }}><SkeletonRow /></td></tr>) :
            sorted.map((p, i) => {
              const pplPct = (p.averagePrice || 0) > 0 ? (p.ppl / ((p.averagePrice || 1) * (p.quantity || 1))) * 100 : 0;
              const value = (p.currentPrice || 0) * (p.quantity || 0);
              const isPos = (p.ppl || 0) >= 0;
              const isExp = expanded === p.ticker;
              return (
                <>
                  <motion.tr key={p.ticker} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    onClick={() => setExpanded(isExp ? null : p.ticker)}
                    style={{ cursor: 'pointer', background: isExp ? 'var(--accent-dim)' : 'transparent', transition: 'background 0.15s' }}>
                    <td style={{ ...cell, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{p.ticker}</td>
                    <td style={cell} className="mono">{(p.quantity || 0).toFixed(4)}</td>
                    <td style={cell} className="mono">£{(p.averagePrice || 0).toFixed(2)}</td>
                    <td style={cell} className="mono">£{(p.currentPrice || 0).toFixed(2)}</td>
                    <td style={{ ...cell, color: isPos ? 'var(--gain)' : 'var(--loss)', fontWeight: 600 }} className="mono">{isPos ? '+' : ''}£{(p.ppl || 0).toFixed(2)}</td>
                    <td style={{ ...cell, color: isPos ? 'var(--gain)' : 'var(--loss)', fontWeight: 600 }} className="mono">{isPos ? '+' : ''}{pplPct.toFixed(2)}%</td>
                    <td style={cell} className="mono">£{value.toFixed(2)}</td>
                    <td style={cell}><OutlookBadge outlook={p.analysis?.outlook} /></td>
                    <td style={cell}>
                      {p.sentiment && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <div style={{ width: 44, height: 5, borderRadius: 3, background: `linear-gradient(to right, var(--gain) ${p.sentiment.bullish_pct}%, var(--loss) ${p.sentiment.bullish_pct}%)` }} />
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }} className="mono">{p.sentiment.bullish_pct}%</span>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {isExp && (
                      <motion.tr key={`${p.ticker}-exp`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <td colSpan={9} style={{ padding: 20, background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                            {p.analysis && (
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Analysis</div>
                                <OutlookBadge outlook={p.analysis.outlook} confidence={p.analysis.confidence} risk={p.analysis.risk_level} />
                                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, maxWidth: 300, lineHeight: 1.6 }}>{p.analysis.reason}</div>
                              </div>
                            )}
                            {p.market && (
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Market Data</div>
                                <div className="mono" style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', color: 'var(--text)' }}>
                                  <span style={{ color: 'var(--text-3)' }}>52W High</span><span>£{(p.market.fiftyTwoWeekHigh||0).toFixed(2)}</span>
                                  <span style={{ color: 'var(--text-3)' }}>52W Low</span><span>£{(p.market.fiftyTwoWeekLow||0).toFixed(2)}</span>
                                  <span style={{ color: 'var(--text-3)' }}>Daily Chg</span><span style={{ color: (p.market.dailyChangePct||0) >= 0 ? 'var(--gain)' : 'var(--loss)' }}>{(p.market.dailyChangePct||0).toFixed(2)}%</span>
                                </div>
                              </div>
                            )}
                            {p.sentiment && (
                              <div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Community</div>
                                <div style={{ display: 'flex', gap: 16 }}>
                                  <span style={{ color: 'var(--gain)', fontSize: 13, fontWeight: 600 }}>▲ {p.sentiment.bullish_pct}% Bullish</span>
                                  <span style={{ color: 'var(--loss)', fontSize: 13, fontWeight: 600 }}>▼ {p.sentiment.bearish_pct}% Bearish</span>
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
