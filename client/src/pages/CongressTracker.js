import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Building2, TrendingUp, TrendingDown, Users, BarChart2, RefreshCw, X, ChevronUp, ChevronDown, Download } from 'lucide-react';
import CountUp from '../components/CountUp';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

const PARTY_COLOR = { D: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }, R: { bg: '#fff1f2', color: '#be123c', border: '#fecdd3' }, I: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' } };
const TYPE_COLOR = { Purchase: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' }, Sale: { bg: '#fff1f2', color: '#be123c', border: '#fecdd3' }, Exchange: { bg: '#fffbeb', color: '#92400e', border: '#fde68a' } };

function Pill({ label, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
      {label}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, mono, delay }) {
  return (
    <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ padding: '18px 20px', flex: 1, minWidth: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
        <div style={{ padding: 7, borderRadius: 9, background: 'var(--accent-dim)' }}>
          <Icon size={13} color="var(--accent)" />
        </div>
      </div>
      {mono
        ? <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.5px' }}><CountUp value={typeof value === 'number' ? value : 0} /></div>
        : <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value || '—'}</div>
      }
    </motion.div>
  );
}

function MemberModal({ member, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get(`${BASE}/congress/member/${encodeURIComponent(member)}`).then(r => setData(r.data)).catch(() => {});
  }, [member]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ duration: 0.25 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 800, maxHeight: '80vh', overflow: 'auto', padding: 28, boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{member}</div>
            {data && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{data.trades?.[0]?.chamber} · {data.trades?.[0]?.state}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}><X size={16} color="var(--text-2)" /></button>
        </div>
        {data?.stats && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[['Total Trades', data.stats.total], ['Total Purchases', `$${(data.stats.totalBuy/1e6).toFixed(1)}M`], ['Total Sales', `$${(data.stats.totalSell/1e6).toFixed(1)}M`], ['Top Ticker', data.stats.topTicker]].map(([l, v]) => (
              <div key={l} className="card" style={{ padding: '12px 16px', flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{l}</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {data?.trades && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data.trades.slice(0, 20).map((t, i) => {
              const tc = TYPE_COLOR[t.transaction_type] || TYPE_COLOR.Exchange;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 600, minWidth: 68, textAlign: 'center' }}>{t.transaction_type}</span>
                  <span className="mono" style={{ fontWeight: 700, minWidth: 60 }}>{t.ticker || '—'}</span>
                  <span style={{ color: 'var(--text-2)', flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.asset_name || '—'}</span>
                  <span className="mono" style={{ color: 'var(--text-2)', fontSize: 12 }}>{t.amount_range || '—'}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-GB') : '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function CongressTracker() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [sortKey, setSortKey] = useState('transaction_date');
  const [sortDir, setSortDir] = useState(-1);

  const [filters, setFilters] = useState({
    member: '', ticker: '', type: 'ALL', chamber: 'ALL', party: 'ALL', asset: 'ALL', page: 1, limit: 25
  });

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }));

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== 'ALL'));
      const res = await axios.get(`${BASE}/congress/trades`, { params });
      setTrades(res.data.trades || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch {}
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);
  useEffect(() => { axios.get(`${BASE}/congress/stats`).then(r => setStats(r.data)).catch(() => {}); }, []);

  const refresh = async () => {
    setRefreshing(true);
    await axios.post(`${BASE}/congress/refresh`).catch(() => {});
    await fetchTrades();
    const r = await axios.get(`${BASE}/congress/stats`).catch(() => ({ data: null }));
    if (r.data) setStats(r.data);
    setRefreshing(false);
  };

  const exportCSV = () => {
    const headers = ['Member', 'Party', 'Chamber', 'State', 'Ticker', 'Asset', 'Type', 'Amount', 'Trade Date', 'Disclosed'];
    const rows = trades.map(t => [t.member_name, t.party, t.chamber, t.state, t.ticker, t.asset_name, t.transaction_type, t.amount_range, t.transaction_date, t.disclosure_date]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v||''}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv])); a.download = 'congress-trades.csv'; a.click();
  };

  const SortIcon = ({ k }) => sortKey === k ? (sortDir === -1 ? <ChevronDown size={11} /> : <ChevronUp size={11} />) : null;

  const scraperAge = stats?.lastScraperRun?.completed_at ? Math.floor((Date.now() - new Date(stats.lastScraperRun.completed_at)) / 60000) : null;
  const scraperStatus = !scraperAge ? 'gray' : scraperAge < 10 ? 'green' : scraperAge < 60 ? 'amber' : 'red';
  const scraperColors = { green: 'var(--gain)', amber: 'var(--warning)', red: 'var(--loss)', gray: 'var(--text-3)' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={20} color="var(--accent)" /> Congress Trading
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Politician stock disclosures · Auto-scraped every 5 minutes</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: scraperColors[scraperStatus], animation: scraperStatus === 'green' ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ color: scraperColors[scraperStatus], fontWeight: 500 }}>
              {scraperAge === null ? 'Pending' : scraperAge < 1 ? 'Just synced' : `Synced ${scraperAge}m ago`}
            </span>
          </div>
          <button onClick={refresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '7px 14px', color: 'var(--accent)', fontSize: 12, fontWeight: 500, cursor: refreshing ? 'default' : 'pointer', transition: 'all 0.15s' }}>
            <RefreshCw size={12} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Scraping...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Total Trades" value={stats?.totalTrades || 0} icon={BarChart2} mono delay={0} />
        <StatCard label="Trades Today" value={stats?.tradesToday || 0} icon={TrendingUp} mono delay={0.05} />
        <StatCard label="This Week" value={stats?.tradesThisWeek || 0} icon={TrendingDown} mono delay={0.1} />
        <StatCard label="Most Active Member" value={stats?.mostActiveMember} icon={Users} delay={0.15} />
        <StatCard label="Most Traded Ticker" value={stats?.mostTradedTicker} icon={BarChart2} delay={0.2} />
      </div>

      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={filters.member} onChange={e => setFilter('member', e.target.value)} placeholder="Member name..." style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '7px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', width: 180 }} />
          <input value={filters.ticker} onChange={e => setFilter('ticker', e.target.value.toUpperCase())} placeholder="Ticker..." style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '7px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none', width: 100 }} />
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {['ALL','Purchase','Sale','Exchange'].map(v => <Pill key={v} label={v} active={filters.type===v} onClick={() => setFilter('type', v)} />)}
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {[['ALL','All'],['House','House'],['Senate','Senate']].map(([v,l]) => <Pill key={v} label={l} active={filters.chamber===v} onClick={() => setFilter('chamber', v)} />)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Party:</span>
          {[['ALL','All'],['D','Democrat'],['R','Republican'],['I','Independent']].map(([v,l]) => <Pill key={v} label={l} active={filters.party===v} onClick={() => setFilter('party', v)} />)}
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Asset:</span>
          {['ALL','Stock','ETF','Bond','Crypto','Option'].map(v => <Pill key={v} label={v} active={filters.asset===v} onClick={() => setFilter('asset', v)} />)}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {(filters.member || filters.ticker || filters.type !== 'ALL' || filters.chamber !== 'ALL' || filters.party !== 'ALL' || filters.asset !== 'ALL') && (
              <button onClick={() => setFilters(f => ({ ...f, member: '', ticker: '', type: 'ALL', chamber: 'ALL', party: 'ALL', asset: 'ALL', page: 1 }))} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 20, background: 'var(--loss-dim)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--loss)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                <X size={10} /> Clear filters
              </button>
            )}
            <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
              <Download size={10} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-3)' }}>
          <span>{total.toLocaleString()} trades found</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                {[['member_name','Member'],['party','Party'],['chamber','Chamber'],['ticker','Ticker'],['asset_type','Asset'],['transaction_type','Type'],['amount_range','Amount'],['transaction_date','Trade Date'],['disclosure_date','Disclosed']].map(([k,l]) => (
                  <th key={k} onClick={() => { setSortKey(k); setSortDir(d => sortKey===k ? -d : -1); }}
                    style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.7, cursor: 'pointer', padding: '11px 14px', whiteSpace: 'nowrap', background: 'var(--surface-2)', textAlign: 'left', userSelect: 'none' }}>
                    {l} <SortIcon k={k} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0,1,2,3,4,5,6].map(i => (
                  <tr key={i}>
                    {[0,1,2,3,4,5,6,7,8].map(j => (
                      <td key={j} style={{ padding: '12px 14px' }}>
                        <div style={{ height: 14, borderRadius: 7, background: 'var(--surface-2)', animation: 'shimmer 1.4s ease-in-out infinite', width: j === 0 ? 140 : j === 6 ? 120 : 70 }} />
                      </td>
                    ))}
                  </tr>
                ))
                : trades.length === 0
                ? (
                  <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
                    <Building2 size={36} style={{ marginBottom: 12, opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No trades found</div>
                    <div style={{ fontSize: 12 }}>Try clearing your filters or refresh to fetch latest data.</div>
                  </td></tr>
                )
                : trades.map((t, i) => {
                  const pc = PARTY_COLOR[t.party] || PARTY_COLOR.I;
                  const tc = TYPE_COLOR[t.transaction_type] || TYPE_COLOR.Exchange;
                  const tradeDate = t.transaction_date ? new Date(t.transaction_date) : null;
                  const discDate = t.disclosure_date ? new Date(t.disclosure_date) : null;
                  const lag = tradeDate && discDate ? Math.round((discDate - tradeDate) / 86400000) : null;
                  return (
                    <motion.tr key={t.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.12s', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderLeft = '3px solid var(--accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeft = 'none'; }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setSelectedMember(t.member_name)}>{t.member_name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {t.party && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, fontWeight: 700 }}>{t.party === 'D' ? 'DEM' : t.party === 'R' ? 'REP' : 'IND'}</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-2)' }}>{t.chamber}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13 }}>{t.ticker || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-2)' }}>{t.asset_type || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {t.transaction_type && <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 600 }}>{t.transaction_type}</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text-2)' }}>{t.amount_range || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-2)' }}>{tradeDate ? tradeDate.toLocaleDateString('en-GB') : '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12 }}>
                        <span style={{ color: lag !== null && lag > 30 ? 'var(--loss)' : 'var(--text-3)' }}>
                          {discDate ? discDate.toLocaleDateString('en-GB') : '—'}
                          {lag !== null && <span style={{ fontSize: 10, marginLeft: 5 }}>({lag}d)</span>}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '14px', borderTop: '1px solid var(--border)' }}>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setFilters(f => ({ ...f, page: p }))}
                  style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${filters.page === p ? 'var(--accent)' : 'var(--border)'}`, background: filters.page === p ? 'var(--accent-dim)' : 'transparent', color: filters.page === p ? 'var(--accent)' : 'var(--text-3)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  {p}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedMember && <MemberModal member={selectedMember} onClose={() => setSelectedMember(null)} />}
      </AnimatePresence>
    </div>
  );
}
