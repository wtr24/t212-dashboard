import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Search, TrendingUp, TrendingDown, BarChart2, Activity, X } from 'lucide-react';
import TradingChart from '../components/TradingChart';
import { useApi } from '../hooks/useApi';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

const SECTOR_COLORS = {
  'Information Technology': '#3b82f6',
  'Health Care': '#10b981',
  'Financials': '#8b5cf6',
  'Consumer Discretionary': '#f59e0b',
  'Communication Services': '#06b6d4',
  'Industrials': '#6366f1',
  'Consumer Staples': '#84cc16',
  'Energy': '#f97316',
  'Utilities': '#ec4899',
  'Real Estate': '#a78bfa',
  'Materials': '#34d399',
};

function QuotePanel({ quote, loading }) {
  if (loading || !quote) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[100, 80, 60, 80, 60].map((w, i) => (
          <div key={i} style={{ height: 14, width: w, background: 'rgba(255,255,255,0.06)', borderRadius: 4, animation: 'shimmer 1.4s infinite', backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '600px 100%' }} />
        ))}
      </div>
    );
  }
  const isPos = (quote.changePct || 0) >= 0;
  const stats = [
    ['Open', `$${(quote.open || 0).toFixed(2)}`],
    ['High', `$${(quote.high || 0).toFixed(2)}`],
    ['Low', `$${(quote.low || 0).toFixed(2)}`],
    ['52W High', `$${(quote.fiftyTwoWeekHigh || 0).toFixed(2)}`],
    ['52W Low', `$${(quote.fiftyTwoWeekLow || 0).toFixed(2)}`],
    ['Volume', quote.volume ? `${(quote.volume / 1e6).toFixed(1)}M` : '—'],
  ];
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Current Price</div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>${(quote.price || 0).toFixed(2)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {isPos ? <TrendingUp size={13} color="#10b981" /> : <TrendingDown size={13} color="#ef4444" />}
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 600, color: isPos ? '#10b981' : '#ef4444' }}>
            {isPos ? '+' : ''}{(quote.change || 0).toFixed(2)} ({isPos ? '+' : ''}{(quote.changePct || 0).toFixed(2)}%)
          </span>
        </div>
        {quote.currency && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{quote.currency} · {quote.name || ''}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {stats.map(([l, v]) => (
          <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{l}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 500, color: '#94a3b8' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [recentTickers, setRecentTickers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('recent_tickers') || '[]'); } catch { return []; }
  });
  const debounceRef = useRef(null);

  const search = useCallback((q) => {
    if (!q || q.length < 1) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      axios.get(`${BASE}/stocks/search?q=${encodeURIComponent(q)}`).then(r => {
        setResults(r.data || []);
      }).catch(() => setResults([]));
    }, 300);
  }, []);

  const select = (ticker, company) => {
    setQuery('');
    setOpen(false);
    setResults([]);
    const updated = [{ ticker, company }, ...recentTickers.filter(t => t.ticker !== ticker)].slice(0, 8);
    setRecentTickers(updated);
    try { localStorage.setItem('recent_tickers', JSON.stringify(updated)); } catch {}
    onSelect(ticker);
  };

  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 16px', transition: 'border-color 0.15s' }}
        onFocus={() => setOpen(true)}>
        <Search size={14} color="#475569" />
        <input value={query} onChange={e => { setQuery(e.target.value); search(e.target.value); setOpen(true); }}
          onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery(''); } if (e.key === 'Enter' && results[0]) select(results[0].ticker, results[0].company); }}
          placeholder="Search SP500 stocks..." style={{ background: 'none', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: 14, width: '100%', fontFamily: 'Outfit' }} />
        {query && <button onClick={() => { setQuery(''); setResults([]); }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex' }}><X size={12} /></button>}
      </div>
      {open && (results.length > 0 || (recentTickers.length > 0 && !query)) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0c1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, marginTop: 4, zIndex: 100, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
          onMouseDown={e => e.preventDefault()}>
          {!query && recentTickers.length > 0 && (
            <>
              <div style={{ padding: '8px 14px', fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recent</div>
              {recentTickers.slice(0, 5).map(t => (
                <div key={t.ticker} onClick={() => select(t.ticker, t.company)}
                  style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#3b82f6', minWidth: 60 }}>{t.ticker}</span>
                  <span style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.company}</span>
                </div>
              ))}
              {results.length > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />}
            </>
          )}
          {results.map(r => (
            <div key={r.ticker} onClick={() => select(r.ticker, r.company)}
              style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#3b82f6', minWidth: 60 }}>{r.ticker}</span>
              <span style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.company}</span>
              {r.sector && <span style={{ fontSize: 10, color: SECTOR_COLORS[r.sector] || '#64748b', background: `${SECTOR_COLORS[r.sector] || '#64748b'}18`, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap' }}>{r.sector}</span>}
            </div>
          ))}
        </div>
      )}
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />}
    </div>
  );
}

export default function Charts() {
  const [ticker, setTicker] = useState('SPY');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const { data: allocation } = useApi('/portfolio/allocation');

  const handleQuoteUpdate = useCallback((q) => {
    setQuote(q);
    setQuoteLoading(false);
  }, []);

  const handleTickerSelect = (t) => {
    setTicker(t);
    setQuote(null);
    setQuoteLoading(true);
  };

  const myHoldings = (allocation?.byStock || []).slice(0, 8);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChart2 size={19} color="#3b82f6" /> Charts
        </h2>
        <SearchBar onSelect={handleTickerSelect} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, marginBottom: 24 }}>
        <TradingChart ticker={ticker} height={440} onQuoteUpdate={handleQuoteUpdate} />
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <QuotePanel quote={quote} loading={quoteLoading} />
        </div>
      </div>

      {myHoldings.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>My Holdings</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {myHoldings.map(h => {
              const cleanTicker = h.ticker?.replace(/_[A-Z]{2}_EQ$/, '').replace(/_[A-Z]+$/, '') || h.ticker;
              return (
                <motion.button key={h.ticker} onClick={() => handleTickerSelect(cleanTicker)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${ticker === cleanTicker ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, background: ticker === cleanTicker ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)', color: ticker === cleanTicker ? '#3b82f6' : '#94a3b8', fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {cleanTicker}
                  <div style={{ fontSize: 10, color: ticker === cleanTicker ? 'rgba(59,130,246,0.8)' : '#475569', fontWeight: 400, marginTop: 2 }}>
                    {h.pct?.toFixed(1)}%
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Portfolio Allocation</div>
          {(allocation?.byStock || []).slice(0, 10).map((s, i) => {
            const cleanTicker = s.ticker?.replace(/_[A-Z]{2}_EQ$/, '').replace(/_[A-Z]+$/, '') || s.ticker;
            return (
              <div key={s.ticker} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }} onClick={() => handleTickerSelect(cleanTicker)}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#3b82f6', minWidth: 60 }}>{cleanTicker}</div>
                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.pct || 0}%`, background: `hsl(${210 + i * 22},80%,60%)`, borderRadius: 3 }} />
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#64748b', minWidth: 36, textAlign: 'right' }}>{(s.pct || 0).toFixed(1)}%</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Quick Access · Popular</div>
          {['SPY', 'QQQ', 'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM'].map(t => (
            <div key={t} onClick={() => handleTickerSelect(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'all 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.paddingLeft = '8px'}
              onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}>
              <Activity size={12} color={ticker === t ? '#3b82f6' : '#475569'} />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: ticker === t ? '#3b82f6' : '#94a3b8' }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
