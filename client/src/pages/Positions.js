import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import DataBanner from '../components/DataBanner';
import { SkeletonRow } from '../components/Skeleton';
import { StockLogo } from '../utils/stockLogo';
import { Search, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';

const COMPANY_MAP = {
  PLTR:'Palantir Technologies',NVDA:'NVIDIA Corporation',AAPL:'Apple Inc.',
  MSFT:'Microsoft Corporation',TSLA:'Tesla Inc.',META:'Meta Platforms',
  GOOGL:'Alphabet Inc.',AMZN:'Amazon.com Inc.',JPM:'JPMorgan Chase',
  AMD:'Advanced Micro Devices',INTC:'Intel Corporation',NFLX:'Netflix Inc.',
  CRM:'Salesforce Inc.',ADBE:'Adobe Inc.',CRWD:'CrowdStrike',
  COIN:'Coinbase Global',HOOD:'Robinhood Markets',ARM:'Arm Holdings',
  SMCI:'Super Micro Computer',SNOW:'Snowflake Inc.',NET:'Cloudflare',
};

const SECTOR_MAP = {
  NVDA:'Semiconductors',AMD:'Semiconductors',INTC:'Semiconductors',QCOM:'Semiconductors',
  AAPL:'Technology',MSFT:'Technology',GOOGL:'Technology',META:'Technology',
  AMZN:'E-Commerce',TSLA:'Automotive',NFLX:'Media',CRM:'SaaS',
  PLTR:'Data Analytics',CRWD:'Cybersecurity',COIN:'Crypto',HOOD:'Fintech',
};

function cleanTicker(raw) {
  if (!raw) return raw;
  return raw.replace(/[_](US|UK|EQ|NASDAQ|NYSE|LSE|ALL)[_A-Z0-9]*/g, '') || raw.split('_')[0];
}

function fmt(n, d = 2) { return (n || 0).toFixed(d); }
function fmtGbp(n) { return `£${Math.abs(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export default function Positions() {
  const { data: raw, loading, refetch } = useApi('/portfolio/positions', { pollInterval: 60000 });
  const rawPositions = raw?.positions || (Array.isArray(raw) ? raw : []);

  const [sortKey, setSortKey] = useState('value');
  const [sortDir, setSortDir] = useState(-1);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const positions = useMemo(() => rawPositions.map(p => ({
    ...p,
    ticker: cleanTicker(p.ticker) || p.ticker,
    companyName: p.companyName || COMPANY_MAP[cleanTicker(p.ticker)] || cleanTicker(p.ticker),
    sector: SECTOR_MAP[cleanTicker(p.ticker)] || null,
    value: ((p.currentPrice || 0) > 0 ? p.currentPrice : (p.averagePrice || 0)) * (p.quantity || 0),
    pplPct: (p.averagePrice || 0) > 0 ? ((p.ppl || 0) / ((p.averagePrice || 1) * (p.quantity || 1))) * 100 : 0,
  })), [rawPositions]);

  const totalValue = useMemo(() => positions.reduce((s, p) => s + p.value, 0), [positions]);
  const totalPpl = useMemo(() => positions.reduce((s, p) => s + (p.ppl || 0), 0), [positions]);
  const totalCost = useMemo(() => positions.reduce((s, p) => s + (p.averagePrice || 0) * (p.quantity || 0), 0), [positions]);

  const sort = (k) => { if (sortKey === k) setSortDir(d => -d); else { setSortKey(k); setSortDir(-1); } };

  const filtered = positions
    .filter(p => !search || p.ticker?.toLowerCase().includes(search.toLowerCase()) || p.companyName?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? 0; const bv = b[sortKey] ?? 0;
      return typeof av === 'string' ? av.localeCompare(bv) * sortDir : (bv - av) * sortDir;
    });

  const posGain = totalPpl >= 0;
  const overallPct = totalCost > 0 ? (totalPpl / totalCost) * 100 : 0;

  const sortBtn = (k, label) => (
    <button onClick={() => sort(k)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${sortKey === k ? 'rgba(59,130,246,0.5)' : 'var(--border)'}`, background: sortKey === k ? 'rgba(59,130,246,0.12)' : 'transparent', color: sortKey === k ? '#3b82f6' : 'var(--text-3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
      {label} {sortKey === k ? (sortDir === -1 ? '↓' : '↑') : ''}
    </button>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <DataBanner source={raw?.source} age={raw?.age} onRefresh={refetch} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Positions <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 15 }}>({filtered.length})</span></h2>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Your current portfolio holdings</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: '8px 16px' }}>
          <Search size={14} color="var(--text-3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, width: 160 }} />
        </div>
      </div>

      {!loading && positions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total Value', value: fmtGbp(totalValue), mono: true },
            { label: 'Invested', value: fmtGbp(totalCost), mono: true },
            { label: 'Total P&L', value: `${posGain?'+':''}${fmtGbp(totalPpl)}`, color: posGain ? 'var(--gain)' : 'var(--loss)', mono: true },
            { label: 'Return', value: `${posGain?'+':''}${fmt(overallPct)}%`, color: posGain ? 'var(--gain)' : 'var(--loss)', mono: true },
          ].map(({ label, value, color, mono }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)', fontFamily: mono ? 'JetBrains Mono, monospace' : undefined }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center', marginRight: 4 }}>Sort:</span>
        {sortBtn('value', 'Value')}
        {sortBtn('ppl', 'P&L £')}
        {sortBtn('pplPct', 'P&L %')}
        {sortBtn('ticker', 'A–Z')}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0,1,2,3,4].map(i => <div key={i} className="card" style={{ height: 120 }}><SkeletonRow /></div>)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 16 }}>
          {filtered.map((p, i) => {
            const isPos = (p.ppl || 0) >= 0;
            const weightPct = totalValue > 0 ? (p.value / totalValue) * 100 : 0;
            const isExp = expanded === p.ticker;
            const accentColor = isPos ? 'var(--gain)' : 'var(--loss)';

            return (
              <motion.div
                key={p.ticker}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setExpanded(isExp ? null : p.ticker)}
                style={{ background: 'var(--surface)', border: `1px solid ${isExp ? (isPos ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)') : 'var(--border)'}`, borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                whileHover={{ y: -2, boxShadow: `0 8px 32px ${isPos ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}` }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accentColor}, transparent)`, opacity: 0.6 }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                  <StockLogo ticker={p.ticker} size="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{p.companyName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', padding: '2px 8px', borderRadius: 6 }}>{p.ticker}</span>
                      {p.sector && <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 6 }}>{p.sector}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>£{fmt(p.currentPrice)}</div>
                    {p.market?.dailyChangePct != null && (
                      <div style={{ fontSize: 12, color: (p.market.dailyChangePct || 0) >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                        {(p.market.dailyChangePct || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {(p.market.dailyChangePct || 0) >= 0 ? '+' : ''}{fmt(p.market.dailyChangePct)}% today
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>Avg Cost</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: 'var(--text-2)' }}>£{fmt(p.averagePrice)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>Shares</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: 'var(--text-2)' }}>{fmt(p.quantity, 4)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>P&L</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: accentColor }}>
                      {isPos ? '+' : '-'}{fmtGbp(p.ppl)} <span style={{ fontSize: 12, fontWeight: 500 }}>({isPos ? '+' : ''}{fmt(p.pplPct)}%)</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>Market Value</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{fmtGbp(p.value)}</div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Portfolio Weight</span>
                    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-2)' }}>{fmt(weightPct, 1)}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${weightPct}%`, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`, borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                </div>

                {isExp && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {p.market && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Market Data</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 16px', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-3)' }}>52W High</span><span style={{ fontFamily: 'JetBrains Mono, monospace' }}>£{fmt(p.market.fiftyTwoWeekHigh)}</span>
                          <span style={{ color: 'var(--text-3)' }}>52W Low</span><span style={{ fontFamily: 'JetBrains Mono, monospace' }}>£{fmt(p.market.fiftyTwoWeekLow)}</span>
                        </div>
                      </div>
                    )}
                    {p.analysis && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>AI Signal</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: p.analysis.outlook === 'bullish' ? 'var(--gain)' : p.analysis.outlook === 'bearish' ? 'var(--loss)' : 'var(--text-2)', textTransform: 'capitalize' }}>{p.analysis.outlook || 'neutral'}</span>
                          {p.analysis.confidence && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.analysis.confidence}% confidence</span>}
                        </div>
                        {p.analysis.reason && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, maxWidth: 260, lineHeight: 1.5 }}>{p.analysis.reason}</div>}
                      </div>
                    )}
                    {p.sentiment && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Community</div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <span style={{ color: 'var(--gain)', fontSize: 12, fontWeight: 600 }}>▲ {p.sentiment.bullish_pct}%</span>
                          <span style={{ color: 'var(--loss)', fontSize: 12, fontWeight: 600 }}>▼ {p.sentiment.bearish_pct}%</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
          <ArrowUpRight size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>No positions found</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Add a T212 API key to see your portfolio</div>
        </div>
      )}
    </div>
  );
}
