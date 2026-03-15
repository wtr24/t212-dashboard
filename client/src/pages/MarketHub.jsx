import { useState, useEffect } from 'react';
import { Globe, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5002';

function MetricRow({ label, value, prev, change, impact, unit = '', colorFn }) {
  const color = colorFn ? colorFn(value) : (change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#94a3b8');
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 8 }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 3 }}>{label}</div>
        {impact && <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>{impact}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color }}>{value != null ? value + unit : '—'}</div>
        {change != null && (
          <div style={{ fontSize: 11, color: change >= 0 ? '#10b981' : '#ef4444' }}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
}

function SectorBar({ name, change }) {
  const color = change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#64748b';
  const width = Math.min(100, Math.abs(change) * 15);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', width: 130, flexShrink: 0 }}>{name}</div>
      <div style={{ flex: 1, height: 18, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: change > 0 ? '50%' : `calc(50% - ${width / 2}%)`, width: width / 2 + '%', height: '100%', background: color + '60', transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color, width: 55, textAlign: 'right' }}>
        {change != null ? (change >= 0 ? '+' : '') + change.toFixed(2) + '%' : '—'}
      </div>
    </div>
  );
}

export default function MarketHub() {
  const [macro, setMacro] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [macroR, earnR] = await Promise.allSettled([
      axios.get(API + '/api/decisions/macro'),
      axios.get(API + '/api/earnings/week'),
    ]);
    if (macroR.status === 'fulfilled') {
      setMacro(macroR.value.data.macro);
      setSectors(macroR.value.data.sectors || []);
    }
    if (earnR.status === 'fulfilled') {
      const byDay = macroR.value.data;
      // Flatten week earnings
      const flat = Object.entries(earnR.value.data || {}).flatMap(([date, rows]) =>
        rows.map(r => ({ ...r, report_date: date }))
      );
      setEarnings(flat);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const vix = macro?.vix;
  const fg = macro?.fearGreed;
  const { nyseOpen, lseOpen } = macro?.marketStatus || {};

  const card = (extra = {}) => ({ padding: '20px 22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, ...extra });
  const sectionTitle = (t) => <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 14 }}>{t}</div>;

  // Group earnings by day
  const earningsByDay = {};
  earnings.forEach(e => {
    const d = e.report_date?.split('T')[0];
    if (!earningsByDay[d]) earningsByDay[d] = [];
    earningsByDay[d].push(e);
  });
  const days = Object.keys(earningsByDay).sort().slice(0, 7);

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={20} color="#3b82f6" /> Market Intelligence Hub
          </h1>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            <span style={{ marginRight: 12 }}>NYSE <span style={{ color: nyseOpen ? '#10b981' : '#ef4444', fontWeight: 700 }}>{nyseOpen ? '● OPEN' : '● CLOSED'}</span></span>
            <span>LSE <span style={{ color: lseOpen ? '#10b981' : '#ef4444', fontWeight: 700 }}>{lseOpen ? '● OPEN' : '● CLOSED'}</span></span>
          </div>
        </div>
        <button onClick={refresh} disabled={refreshing} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Top row: Macro + Sectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Macro dashboard */}
        <div style={card({})}>
          {sectionTitle('MACRO DASHBOARD')}
          {loading ? (
            <div style={{ color: '#475569', fontSize: 13 }}>Loading macro data...</div>
          ) : (
            <>
              <MetricRow
                label="VIX — Volatility Index"
                value={vix?.value?.toFixed(1)}
                change={vix?.change}
                impact={vix?.value > 30 ? '⚠ Elevated fear — options premiums high' : vix?.value > 20 ? 'Moderate uncertainty in market' : 'Market calm — low volatility regime'}
                colorFn={v => v > 30 ? '#ef4444' : v > 20 ? '#f59e0b' : '#10b981'}
              />
              <MetricRow
                label="Fear & Greed Index (CNN)"
                value={fg?.score}
                unit="/100"
                impact={fg?.score < 25 ? '🟢 Extreme Fear — historically good buy zone' : fg?.score > 75 ? '🔴 Extreme Greed — take profits, elevated risk' : fg?.score < 45 ? 'Fear present — cautious optimism possible' : 'Greed present — be selective'}
                colorFn={v => v < 30 ? '#ef4444' : v > 70 ? '#10b981' : '#f59e0b'}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                {[
                  { label: 'Market Regime', value: vix?.value > 30 ? 'HIGH VOLATILITY' : vix?.value > 20 ? 'ELEVATED VOL' : 'LOW VOLATILITY', color: vix?.value > 30 ? '#ef4444' : vix?.value > 20 ? '#f59e0b' : '#10b981' },
                  { label: 'Sentiment', value: fg?.rating?.toUpperCase() || '—', color: fg?.score < 30 ? '#ef4444' : fg?.score > 70 ? '#10b981' : '#f59e0b' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 1, marginBottom: 5 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sector heatmap */}
        <div style={card({})}>
          {sectionTitle('SECTOR PERFORMANCE TODAY')}
          {loading ? (
            <div style={{ color: '#475569', fontSize: 13 }}>Loading sectors...</div>
          ) : sectors.length === 0 ? (
            <div style={{ color: '#475569', fontSize: 13 }}>No sector data available</div>
          ) : (
            [...sectors].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0)).map(s => (
              <SectorBar key={s.ticker} name={s.name} change={s.changePercent} />
            ))
          )}
        </div>
      </div>

      {/* Bottom row: Earnings calendar + Sector detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Earnings calendar */}
        <div style={card({})}>
          {sectionTitle('EARNINGS CALENDAR — NEXT 7 DAYS')}
          {days.length === 0 ? (
            <div style={{ color: '#475569', fontSize: 13 }}>No upcoming earnings data</div>
          ) : days.map(day => {
            const rows = earningsByDay[day] || [];
            const date = new Date(day);
            const isToday = day === new Date().toISOString().split('T')[0];
            return (
              <div key={day} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#3b82f6' : '#94a3b8', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isToday && <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontSize: 10 }}>TODAY</span>}
                  {date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                  <span style={{ color: '#475569', fontWeight: 400 }}>({rows.length} companies)</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {rows.slice(0, 8).map((r, i) => (
                    <a key={i} href={`/research/${r.ticker}`} style={{ textDecoration: 'none' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: r.ai_signal ? ({ 'BUY': 'rgba(34,211,238,0.1)', 'STRONG BUY': 'rgba(16,185,129,0.12)', 'SELL': 'rgba(239,68,68,0.1)', 'HOLD': 'rgba(245,158,11,0.1)' }[r.ai_signal] || 'rgba(255,255,255,0.06)') : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 600, cursor: 'pointer' }}>
                        {r.ticker}
                      </span>
                    </a>
                  ))}
                  {rows.length > 8 && <span style={{ fontSize: 11, color: '#475569', padding: '3px 0' }}>+{rows.length - 8} more</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sector detail table */}
        <div style={card({})}>
          {sectionTitle('SECTOR DETAIL')}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Sector', 'ETF', 'Price', 'Change'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...sectors].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0)).map(s => (
                <tr key={s.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 8px', color: '#94a3b8', fontSize: 12 }}>{s.name}</td>
                  <td style={{ padding: '8px 8px', fontFamily: 'JetBrains Mono', color: '#64748b', fontSize: 11 }}>{s.ticker}</td>
                  <td style={{ padding: '8px 8px', fontFamily: 'JetBrains Mono', color: '#f1f5f9', fontSize: 12 }}>{s.price ? '$' + s.price.toFixed(2) : '—'}</td>
                  <td style={{ padding: '8px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: s.changePercent >= 0 ? '#10b981' : '#ef4444' }}>
                    {s.changePercent != null ? (s.changePercent >= 0 ? '+' : '') + s.changePercent.toFixed(2) + '%' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sectors.length === 0 && !loading && <div style={{ color: '#475569', fontSize: 13, padding: '20px 0' }}>No sector data</div>}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
