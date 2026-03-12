import { useState, useEffect } from 'react';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

const GRADE_COLORS = { A: '#10b981', B: '#14b8a6', C: '#f59e0b', D: '#f97316', F: '#ef4444' };
const SIGNAL_COLORS = {
  'STRONG BUY': '#10b981', 'BUY': '#34d399',
  'HOLD': '#f59e0b', 'SELL': '#f97316', 'STRONG SELL': '#ef4444',
};

function trendArrow(trend) {
  if (!trend) return '→';
  if (trend === 'STRONG_UPTREND') return '↑↑';
  if (trend === 'UPTREND') return '↑';
  if (trend === 'STRONG_DOWNTREND') return '↓↓';
  if (trend === 'DOWNTREND') return '↓';
  return '→';
}
function trendColor(trend) {
  if (!trend) return 'var(--text-3)';
  if (trend.includes('UP')) return '#10b981';
  if (trend.includes('DOWN')) return '#ef4444';
  return 'var(--text-3)';
}
function rsiColor(rsi) {
  if (rsi == null) return 'var(--text-3)';
  if (rsi < 30) return '#10b981';
  if (rsi > 70) return '#ef4444';
  return '#3b82f6';
}
function n2(v, d = 2) { return v != null ? Number(v).toFixed(d) : '—'; }
function pct(v) { return v != null ? (v >= 0 ? '+' : '') + Number(v).toFixed(1) + '%' : '—'; }

function CompactPanel({ ta }) {
  if (!ta) return <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '6px 0' }}>No technical data</div>;
  const gc = GRADE_COLORS[ta.technical_grade] || 'var(--text-3)';
  const sc = SIGNAL_COLORS[ta.technical_signal] || 'var(--text-3)';
  const rc = rsiColor(ta.rsi_14);
  const tc = trendColor(ta.trend);
  const score = ta.technical_score ?? 50;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
      {/* Grade badge */}
      <div style={{ width: 26, height: 26, borderRadius: 6, background: `${gc}22`, border: `1px solid ${gc}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: gc, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
        {ta.technical_grade || '?'}
      </div>
      {/* Score bar */}
      <div style={{ flex: '0 0 80px', height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: `linear-gradient(90deg, ${gc}, ${gc}aa)`, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: gc, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{score}</span>
      {/* Signal */}
      <span style={{ fontSize: 11, fontWeight: 700, color: sc, flexShrink: 0 }}>{ta.technical_signal || '—'}</span>
      {/* RSI pill */}
      {ta.rsi_14 != null && (
        <span style={{ fontSize: 10, fontWeight: 600, color: rc, background: `${rc}18`, padding: '2px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
          RSI {Number(ta.rsi_14).toFixed(0)}
        </span>
      )}
      {/* Trend arrow */}
      <span style={{ fontSize: 14, color: tc, fontWeight: 700, flexShrink: 0 }}>{trendArrow(ta.trend)}</span>
      {/* Golden/Death cross */}
      {ta.golden_cross && <span style={{ fontSize: 10, color: '#fbbf24' }}>⭐ GX</span>}
      {ta.death_cross && <span style={{ fontSize: 10, color: '#ef4444' }}>💀 DX</span>}
    </div>
  );
}

function GaugeBar({ value, min = 0, max = 100, lowColor = '#10b981', highColor = '#ef4444', midColor = '#f59e0b' }) {
  const pctVal = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const color = pctVal < 30 ? lowColor : pctVal > 70 ? highColor : midColor;
  return (
    <div style={{ position: 'relative', height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'visible', marginTop: 4 }}>
      <div style={{ position: 'absolute', left: '30%', top: -1, width: 1, height: 10, background: 'rgba(255,255,255,0.15)' }} />
      <div style={{ position: 'absolute', left: '70%', top: -1, width: 1, height: 10, background: 'rgba(255,255,255,0.15)' }} />
      <div style={{ height: '100%', width: `${pctVal}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      <div style={{ position: 'absolute', left: `${pctVal}%`, top: -3, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: color, border: '2px solid var(--surface)', boxShadow: `0 0 6px ${color}` }} />
    </div>
  );
}

function PriceLadder({ ta }) {
  const price = ta.current_price;
  const levels = [
    { label: 'Resistance 2', val: ta.resistance_2, type: 'res' },
    { label: 'Resistance 1', val: ta.resistance_1, type: 'res' },
    { label: 'CURRENT', val: price, type: 'cur' },
    { label: 'Support 1', val: ta.support_1, type: 'sup' },
    { label: 'Support 2', val: ta.support_2, type: 'sup' },
  ].filter(l => l.val != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      {levels.map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 20, borderRadius: 2, background: l.type === 'res' ? '#ef4444' : l.type === 'sup' ? '#10b981' : '#3b82f6', flexShrink: 0 }} />
          <span style={{ color: l.type === 'res' ? '#ef4444' : l.type === 'sup' ? '#10b981' : 'var(--text)', fontWeight: l.type === 'cur' ? 700 : 400, flex: 1 }}>
            {l.label}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: l.type === 'cur' ? 'var(--text)' : 'var(--text-2)' }}>
            ${n2(l.val)}
          </span>
          {l.type !== 'cur' && price && (
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              {Math.abs(((l.val - price) / price) * 100).toFixed(1)}% away
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function FullPanel({ ta }) {
  if (!ta) return <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 16 }}>No technical data available. Refresh to analyse.</div>;
  const gc = GRADE_COLORS[ta.technical_grade] || 'var(--text-3)';
  const sc = SIGNAL_COLORS[ta.technical_signal] || 'var(--text-3)';
  const sectionStyle = { marginBottom: 20 };
  const headerStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 6 };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, fontSize: 12 };
  const labelStyle = { color: 'var(--text-3)' };
  const valStyle = { fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-2)' };

  return (
    <div style={{ padding: '0 4px' }}>
      {/* TREND */}
      <div style={sectionStyle}>
        <div style={headerStyle}>Trend Analysis</div>
        <div style={rowStyle}><span style={labelStyle}>Trend</span><span style={{ ...valStyle, color: trendColor(ta.trend), fontWeight: 600 }}>{trendArrow(ta.trend)} {ta.trend?.replace(/_/g, ' ') || '—'}</span></div>
        <div style={rowStyle}><span style={labelStyle}>vs 20MA</span><span style={{ ...valStyle, color: (ta.price_vs_ma50_pct||0) >= 0 ? '#10b981' : '#ef4444' }}>{pct(ta.price_vs_ma50_pct)}</span></div>
        <div style={rowStyle}><span style={labelStyle}>vs 50MA</span><span style={{ ...valStyle, color: (ta.price_vs_ma50_pct||0) >= 0 ? '#10b981' : '#ef4444' }}>{pct(ta.price_vs_ma50_pct)}</span></div>
        <div style={rowStyle}><span style={labelStyle}>vs 200MA</span><span style={{ ...valStyle, color: (ta.price_vs_ma200_pct||0) >= 0 ? '#10b981' : '#ef4444' }}>{pct(ta.price_vs_ma200_pct)}</span></div>
        <div style={rowStyle}><span style={labelStyle}>50MA vs 200MA</span><span style={valStyle}>{pct(ta.ma50_vs_ma200_pct)}</span></div>
        <div style={rowStyle}><span style={labelStyle}>52W Position</span><span style={valStyle}>{ta.price_vs_52w_pct != null ? Math.round(ta.price_vs_52w_pct) + '%' : '—'}</span></div>
        {ta.golden_cross && <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 6 }}>⭐ Golden Cross active (50MA crossed above 200MA)</div>}
        {ta.death_cross && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>💀 Death Cross active (50MA crossed below 200MA)</div>}
      </div>

      {/* MOMENTUM */}
      <div style={sectionStyle}>
        <div style={headerStyle}>Momentum</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>RSI(14)</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: rsiColor(ta.rsi_14), fontFamily: 'JetBrains Mono, monospace' }}>{n2(ta.rsi_14, 1)} — {ta.rsi_signal || '—'}</span>
          </div>
          {ta.rsi_14 != null && <GaugeBar value={ta.rsi_14} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 5 }}>
            <span>Oversold &lt;30</span><span>Neutral</span><span>Overbought &gt;70</span>
          </div>
        </div>
        <div style={rowStyle}><span style={labelStyle}>MACD</span><span style={{ ...valStyle, color: ta.macd_trend === 'BULLISH' ? '#10b981' : '#ef4444' }}>{ta.macd_trend || '—'} ({n2(ta.macd_histogram, 3)})</span></div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Stochastic</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: rsiColor(ta.stoch_k), fontFamily: 'JetBrains Mono, monospace' }}>K:{n2(ta.stoch_k, 0)} D:{n2(ta.stoch_d, 0)} — {ta.stoch_signal || '—'}</span>
          </div>
          {ta.stoch_k != null && <GaugeBar value={ta.stoch_k} />}
        </div>
      </div>

      {/* VOLATILITY */}
      <div style={sectionStyle}>
        <div style={headerStyle}>Volatility</div>
        <div style={rowStyle}><span style={labelStyle}>ATR(14)</span><span style={valStyle}>${n2(ta.atr_14)} ({n2(ta.atr_pct, 1)}% daily range)</span></div>
        <div style={rowStyle}><span style={labelStyle}>Bollinger Band</span><span style={{ ...valStyle, color: ta.bollinger_position?.includes('ABOVE') ? '#ef4444' : ta.bollinger_position?.includes('BELOW') ? '#10b981' : 'var(--text-2)' }}>{ta.bollinger_position?.replace(/_/g, ' ') || '—'}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Band Width</span><span style={valStyle}>{n2(ta.bollinger_width, 1)}%</span></div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', display: 'flex', gap: 12, marginTop: 2 }}>
          <span>Upper: ${n2(ta.bollinger_upper)}</span>
          <span>Mid: ${n2(ta.bollinger_mid)}</span>
          <span>Lower: ${n2(ta.bollinger_lower)}</span>
        </div>
      </div>

      {/* VOLUME */}
      <div style={sectionStyle}>
        <div style={headerStyle}>Volume</div>
        <div style={rowStyle}><span style={labelStyle}>Volume Ratio</span><span style={{ ...valStyle, color: (ta.volume_ratio||0) > 1.5 ? '#f59e0b' : 'var(--text-2)', fontWeight: (ta.volume_ratio||0) > 1.5 ? 700 : 400 }}>{n2(ta.volume_ratio, 2)}x avg</span></div>
        <div style={rowStyle}><span style={labelStyle}>20d Avg Vol</span><span style={valStyle}>{ta.volume_avg_20d ? Number(ta.volume_avg_20d).toLocaleString() : '—'}</span></div>
        <div style={rowStyle}><span style={labelStyle}>OBV Trend</span><span style={{ ...valStyle, color: ta.obv_trend === 'RISING' ? '#10b981' : '#ef4444' }}>{ta.obv_trend === 'RISING' ? '↑ Accumulation' : ta.obv_trend === 'FALLING' ? '↓ Distribution' : '—'}</span></div>
      </div>

      {/* SUPPORT/RESISTANCE */}
      <div style={sectionStyle}>
        <div style={headerStyle}>Support & Resistance</div>
        <PriceLadder ta={ta} />
      </div>

      {/* SIGNAL SUMMARY */}
      <div style={sectionStyle}>
        <div style={headerStyle}>Signal Summary</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${gc}22`, border: `2px solid ${gc}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: gc, fontFamily: 'JetBrains Mono, monospace' }}>
            {ta.technical_grade || '?'}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: sc }}>{ta.technical_signal || '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Score: {ta.technical_score ?? '—'}/100</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, display: 'flex', gap: 16 }}>
            <span style={{ color: '#10b981' }}>▲ {ta.bull_signals || 0} bull</span>
            <span style={{ color: '#ef4444' }}>▼ {ta.bear_signals || 0} bear</span>
            <span style={{ color: 'var(--text-3)' }}>● {ta.neutral_signals || 0} neutral</span>
          </div>
        </div>
        {Array.isArray(ta.signal_details) && ta.signal_details.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ta.signal_details.map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9 }}>•</span> {d}
              </div>
            ))}
          </div>
        )}
        {ta.analysed_at && (
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 10 }}>
            Last analysed: {new Date(ta.analysed_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TechnicalAnalysisPanel({ ticker, compact = false, initialData = null }) {
  const [ta, setTa] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    fetch(`${BASE}/technical/${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then(d => { setTa(d.error ? null : d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [ticker]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', opacity: 0.5, fontSize: 11, color: 'var(--text-3)' }}>
      <div style={{ width: 12, height: 12, border: '2px solid var(--text-3)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Loading TA...
    </div>
  );
  if (error) return <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '4px 0' }}>TA unavailable</div>;

  return compact ? <CompactPanel ta={ta} /> : <FullPanel ta={ta} />;
}
