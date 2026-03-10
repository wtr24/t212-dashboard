import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Eye, TrendingUp, TrendingDown, BarChart2, RefreshCw, X, ChevronUp, ChevronDown, Download, Loader, DollarSign } from 'lucide-react';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

const TYPE_STYLE = {
  Purchase: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  Sale: { bg: '#fff1f2', color: '#be123c', border: '#fecdd3' },
  'Option Exercise': { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  Gift: { bg: '#f5f3ff', color: '#4c1d95', border: '#ddd6fe' },
};

function formatValue(v) {
  if (!v) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatPrice(v) {
  if (!v) return '—';
  return `$${parseFloat(v).toFixed(2)}`;
}

function Pill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  );
}

function ScraperStatus() {
  const [status, setStatus] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    const r = await axios.get(`${BASE}/insider/scrape-status`).catch(() => null);
    if (r?.data) setStatus(r.data);
    return r?.data;
  }, []);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 15000);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  const trigger = async () => {
    setTriggering(true);
    setTriggerResult(null);
    const r = await axios.post(`${BASE}/insider/scrape`).catch(e => ({ data: { status: 'error', message: e.message } }));
    if (r?.data?.status === 'started') {
      let attempts = 0;
      const poll = setInterval(async () => {
        const s = await fetchStatus();
        attempts++;
        if (!s?.is_running || attempts > 20) {
          clearInterval(poll);
          setTriggering(false);
          setTriggerResult('done');
          setTimeout(() => setTriggerResult(null), 3000);
        }
      }, 3000);
    } else {
      setTriggering(false);
      setTriggerResult(r?.data?.status === 'already_running' ? 'running' : 'error');
      setTimeout(() => setTriggerResult(null), 3000);
    }
  };

  const agoSeconds = status?.last_run_ago_seconds;
  const dotColor = !status ? 'var(--text-3)' : status.is_running ? 'var(--warning)' : agoSeconds < 600 ? 'var(--gain)' : agoSeconds < 3600 ? 'var(--warning)' : 'var(--loss)';
  const agoLabel = !agoSeconds ? 'Pending' : agoSeconds < 60 ? 'Just synced' : agoSeconds < 3600 ? `${Math.floor(agoSeconds / 60)}m ago` : `${Math.floor(agoSeconds / 3600)}h ago`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12 }}>
        {status?.is_running
          ? <Loader size={10} className="spin" color="var(--warning)" />
          : <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
        }
        <span style={{ color: dotColor, fontWeight: 500 }}>{status?.is_running ? 'Scraping...' : agoLabel}</span>
        {status?.next_run_in_seconds > 0 && !status?.is_running && (
          <span style={{ color: 'var(--text-3)', marginLeft: 2 }}>· next in {Math.ceil(status.next_run_in_seconds / 60)}m</span>
        )}
      </div>
      <button onClick={trigger} disabled={triggering || status?.is_running}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: triggerResult === 'done' ? 'var(--gain-dim)' : 'var(--accent-dim)', border: `1px solid ${triggerResult === 'done' ? 'rgba(16,185,129,0.25)' : 'var(--accent-border)'}`, borderRadius: 20, padding: '7px 14px', color: triggerResult === 'done' ? 'var(--gain)' : 'var(--accent)', fontSize: 12, fontWeight: 500, cursor: (triggering || status?.is_running) ? 'default' : 'pointer', transition: 'all 0.15s', opacity: (triggering || status?.is_running) ? 0.6 : 1 }}>
        <RefreshCw size={12} className={(triggering || status?.is_running) ? 'spin' : ''} />
        {triggerResult === 'done' ? 'Done!' : triggering ? 'Starting...' : 'Scrape Now'}
      </button>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, mono, sub, color, delay }) {
  return (
    <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ padding: '18px 20px', flex: 1, minWidth: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
        <div style={{ padding: 7, borderRadius: 9, background: color ? `${color}18` : 'var(--accent-dim)' }}>
          <Icon size={13} color={color || 'var(--accent)'} />
        </div>
      </div>
      {mono
        ? <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: color || 'var(--text)' }}>{value || '—'}</div>
        : <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '—'}</div>
      }
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </motion.div>
  );
}

function InsiderModal({ insiderName, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get(`${BASE}/insider/insider/${encodeURIComponent(insiderName)}`).then(r => setData(r.data)).catch(() => {});
  }, [insiderName]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 760, maxHeight: '78vh', overflow: 'auto', padding: 28, boxShadow: '0 -12px 48px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{insiderName}</div>
            {data?.trades?.[0] && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{data.trades[0].title || 'Insider'} · {data.trades[0].company_name || ''}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--text-2)" /></button>
        </div>
        {data?.stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            {[['Trades', data.stats.total], ['Total Bought', formatValue(data.stats.totalBuy)], ['Total Sold', formatValue(data.stats.totalSell)], ['Top Ticker', data.stats.topTicker || '—']].map(([l, v]) => (
              <div key={l} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{l}</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {data?.trades?.slice(0, 30).map((t, i) => {
          const ts = TYPE_STYLE[t.trade_type] || TYPE_STYLE.Sale;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`, fontWeight: 600, minWidth: 60, textAlign: 'center' }}>{t.trade_type}</span>
              <span className="mono" style={{ fontWeight: 700, minWidth: 55 }}>{t.ticker}</span>
              <span style={{ color: 'var(--text-2)', flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.company_name || '—'}</span>
              <span className="mono" style={{ color: 'var(--text-2)', fontSize: 12 }}>{formatValue(t.value)}</span>
              <span className="mono" style={{ color: 'var(--text-3)', fontSize: 11 }}>{formatPrice(t.price)}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{t.trade_date ? new Date(t.trade_date).toLocaleDateString('en-GB') : '—'}</span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

const SkeletonRow = () => (
  <tr style={{ borderBottom: '1px solid var(--border)' }}>
    {[80, 120, 60, 80, 80, 90, 80, 80].map((w, i) => (
      <td key={i} style={{ padding: '12px 14px' }}>
        <div style={{ height: 13, width: w, borderRadius: 6, background: 'var(--surface-2)', animation: 'shimmer 1.4s ease-in-out infinite', backgroundImage: 'linear-gradient(90deg, #eeede9 25%, #e5e4e0 50%, #eeede9 75%)', backgroundSize: '400px 100%' }} />
      </td>
    ))}
  </tr>
);

export default function InsiderTracker() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedInsider, setSelectedInsider] = useState(null);
  const [sortCol, setSortCol] = useState('trade_date');
  const [sortDir, setSortDir] = useState(-1);

  const [filters, setFilters] = useState({ search: '', type: 'ALL', page: 1, limit: 25 });
  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }));

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search) { params.ticker = filters.search; params.insider = filters.search; }
      if (filters.type !== 'ALL') params.type = filters.type;
      params.page = filters.page;
      params.limit = filters.limit;
      const res = await axios.get(`${BASE}/insider/trades`, { params });
      setTrades(res.data.trades || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch {}
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);
  useEffect(() => { axios.get(`${BASE}/insider/stats`).then(r => setStats(r.data)).catch(() => {}); }, []);

  const exportCSV = () => {
    const h = ['Ticker', 'Company', 'Insider', 'Title', 'Type', 'Price', 'Qty', 'Value', 'Trade Date', 'Filing Date'];
    const rows = trades.map(t => [t.ticker, t.company_name, t.insider_name, t.title, t.trade_type, t.price, t.qty, t.value, t.trade_date, t.filing_date]);
    const csv = [h, ...rows].map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv])); a.download = 'insider-trades.csv'; a.click();
  };

  const hasFilters = filters.search || filters.type !== 'ALL';
  const SortIcon = ({ k }) => sortCol === k ? (sortDir === -1 ? <ChevronDown size={10} /> : <ChevronUp size={10} />) : null;
  const handleSort = k => { setSortCol(k); setSortDir(d => sortCol === k ? -d : -1); };

  const sorted = [...trades].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    if (typeof av === 'string') return sortDir * av.localeCompare(bv);
    return sortDir * (parseFloat(av) - parseFloat(bv));
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eye size={19} color="var(--accent)" /> Insider Tracker
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Real-time SEC Form 4 filings via OpenInsider · Auto-synced every 5 min · Min $100K trades
          </div>
        </div>
        <ScraperStatus />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Total Filings" value={stats?.totalTrades?.toLocaleString()} icon={BarChart2} mono delay={0} />
        <StatCard label="Filings Today" value={stats?.tradesToday?.toLocaleString()} icon={TrendingUp} mono delay={0.05} />
        <StatCard label="This Week" value={stats?.tradesThisWeek?.toLocaleString()} icon={BarChart2} mono delay={0.1} />
        <StatCard label="Biggest Sale"
          value={stats?.biggestSale ? `${stats.biggestSale.ticker} — ${formatValue(stats.biggestSale.value)}` : null}
          sub={stats?.biggestSale?.insider_name}
          icon={TrendingDown} color="var(--loss)" delay={0.15} />
        <StatCard label="Biggest Buy"
          value={stats?.biggestBuy ? `${stats.biggestBuy.ticker} — ${formatValue(stats.biggestBuy.value)}` : null}
          sub={stats?.biggestBuy?.insider_name}
          icon={TrendingUp} color="var(--gain)" delay={0.2} />
      </div>

      <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={filters.search} onChange={e => setFilter('search', e.target.value)}
            placeholder="Search ticker or insider name..."
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '7px 16px', color: 'var(--text)', fontSize: 13, outline: 'none', flex: 1, minWidth: 200 }} />
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {['ALL', 'Purchase', 'Sale', 'Option Exercise', 'Gift'].map(v => (
            <Pill key={v} label={v} active={filters.type === v} onClick={() => setFilter('type', v)} />
          ))}
          {hasFilters && (
            <button onClick={() => setFilters(f => ({ ...f, search: '', type: 'ALL', page: 1 }))}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 20, background: 'var(--loss-dim)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--loss)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{total.toLocaleString()} filings</span>
          <button onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
            <Download size={10} /> Export CSV
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                {[['ticker', 'Stock'], ['company_name', 'Company'], ['trade_type', 'Type'], ['insider_name', 'Insider'], ['title', 'Title'], ['value', 'Value'], ['price', 'Price'], ['qty', 'Qty'], ['trade_date', 'Trade Date'], ['filing_date', 'Filed']].map(([k, l]) => (
                  <th key={k} onClick={() => handleSort(k)}
                    style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.7, cursor: 'pointer', padding: '11px 14px', whiteSpace: 'nowrap', background: 'var(--surface-2)', textAlign: 'left', userSelect: 'none' }}>
                    {l} <SortIcon k={k} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0, 1, 2, 3, 4, 5, 6, 7].map(i => <SkeletonRow key={i} />)
                : sorted.length === 0
                ? (
                  <tr><td colSpan={10} style={{ padding: 56, textAlign: 'center', color: 'var(--text-3)' }}>
                    <Eye size={36} style={{ marginBottom: 12, opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No filings found</div>
                    <div style={{ fontSize: 12 }}>Try clearing your filters or click Scrape Now.</div>
                  </td></tr>
                )
                : sorted.map((t, i) => {
                  const ts = TYPE_STYLE[t.trade_type] || TYPE_STYLE.Sale;
                  const deltaPct = t.delta_own_pct ? parseFloat(t.delta_own_pct) : null;
                  return (
                    <motion.tr key={t.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'all 0.12s', cursor: 'default' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.boxShadow = 'inset 2px 0 0 var(--accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{t.ticker || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-2)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.company_name || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {t.trade_type && <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`, fontWeight: 600, whiteSpace: 'nowrap' }}>{t.trade_type}</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setSelectedInsider(t.insider_name)}>{t.insider_name || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{t.title || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: t.trade_type === 'Purchase' ? 'var(--gain)' : t.trade_type === 'Sale' ? 'var(--loss)' : 'var(--text)' }}>
                          {formatValue(t.value)}
                        </div>
                        {deltaPct !== null && (
                          <div style={{ fontSize: 10, color: deltaPct < 0 ? 'var(--loss)' : 'var(--gain)', marginTop: 2 }}>
                            {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}% own
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text-2)' }}>{formatPrice(t.price)}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text-2)' }}>
                        {t.qty ? parseInt(t.qty).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                        {t.trade_date ? new Date(t.trade_date).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                        {t.filing_date ? new Date(t.filing_date).toLocaleDateString('en-GB') : '—'}
                      </td>
                    </motion.tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: 14, borderTop: '1px solid var(--border)' }}>
            {Array.from({ length: Math.min(pages, 9) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setFilters(f => ({ ...f, page: p }))}
                style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${filters.page === p ? 'var(--accent)' : 'var(--border)'}`, background: filters.page === p ? 'var(--accent-dim)' : 'transparent', color: filters.page === p ? 'var(--accent)' : 'var(--text-3)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedInsider && <InsiderModal insiderName={selectedInsider} onClose={() => setSelectedInsider(null)} />}
      </AnimatePresence>
    </div>
  );
}
