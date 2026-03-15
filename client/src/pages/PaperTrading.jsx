import { useState, useEffect, useCallback } from 'react';
import { FlaskConical, RefreshCw, Play, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Target, Award } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line } from 'recharts';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5002';

const TYPE_COLOR = {
  MOMENTUM: '#3b82f6', MEAN_REVERSION: '#8b5cf6', SIGNALS_ONLY: '#22d3ee',
  VALUE: '#10b981', EARNINGS: '#f59e0b', TREND_FOLLOWING: '#f97316',
};

const RiskBar = ({ level }) => {
  const color = level <= 3 ? '#10b981' : level <= 6 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ width: 5, height: 12, borderRadius: 2, background: i < level ? color : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>
      <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'JetBrains Mono' }}>{level}</span>
    </div>
  );
};

function PortfolioModal({ portfolio, onClose }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    axios.get(API + '/api/paper/portfolios/' + portfolio.id).then(r => setDetail(r.data)).catch(() => {});
  }, [portfolio.id]);

  const typeColor = TYPE_COLOR[portfolio.strategy_type] || '#94a3b8';
  const retColor = parseFloat(portfolio.total_return_pct || 0) >= 0 ? '#10b981' : '#ef4444';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: 760, maxHeight: '85vh', overflowY: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: 18, fontWeight: 700 }}>{portfolio.name}</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ padding: '2px 8px', borderRadius: 5, background: typeColor + '20', color: typeColor, fontSize: 11, fontWeight: 700 }}>{portfolio.strategy_type?.replace(/_/g, ' ')}</span>
              <RiskBar level={portfolio.risk_level} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 24, fontWeight: 700, color: retColor }}>
              {parseFloat(portfolio.total_return_pct || 0) >= 0 ? '+' : ''}{parseFloat(portfolio.total_return_pct || 0).toFixed(2)}%
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>£{parseFloat(portfolio.current_value || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* Performance chart */}
        {detail?.snapshots?.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 10 }}>PERFORMANCE OVER TIME</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={detail.snapshots}>
                <XAxis dataKey="snapshot_date" tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={d => d?.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={v => v?.toFixed(1) + '%'} dataKey="return_pct" />
                <Tooltip formatter={(v) => [v?.toFixed(2) + '%', 'Return']} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Line type="monotone" dataKey="return_pct" stroke={retColor} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Positions */}
        {detail?.positions?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 10 }}>CURRENT POSITIONS ({detail.positions.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {detail.positions.slice(0, 6).map(p => {
                const pnl = parseFloat(p.unrealised_pnl_pct || 0);
                return (
                  <div key={p.ticker} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{p.ticker}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent trades */}
        {detail?.recentTrades?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 10 }}>RECENT TRADES</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Action', 'Ticker', 'Qty', 'Price', 'Total', 'Reason'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#475569', fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.recentTrades.slice(0, 10).map((t, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 8px', color: t.action === 'BUY' ? '#10b981' : '#ef4444', fontWeight: 700 }}>{t.action}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'JetBrains Mono', color: '#f1f5f9', fontWeight: 700 }}>{t.ticker}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'JetBrains Mono', color: '#94a3b8' }}>{parseFloat(t.quantity).toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'JetBrains Mono', color: '#94a3b8' }}>${parseFloat(t.price).toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'JetBrains Mono', color: '#f1f5f9' }}>£{parseFloat(t.total_value).toFixed(0)}</td>
                    <td style={{ padding: '6px 8px', color: '#64748b', fontSize: 11 }}>{t.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={onClose} style={{ marginTop: 20, padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>Close</button>
      </div>
    </div>
  );
}

function LeaderboardRow({ p, realReturn, rank, onSelect }) {
  const ret = parseFloat(p.total_return_pct || 0);
  const retColor = ret >= 0 ? '#10b981' : '#ef4444';
  const typeColor = TYPE_COLOR[p.strategy_type] || '#94a3b8';
  const beatingReal = realReturn != null && ret > realReturn;
  const isFirst = rank === 1;
  const winRate = p.total_trades > 0 ? Math.round(parseFloat(p.winning_trades || 0) / parseFloat(p.total_trades) * 100) : 0;

  return (
    <tr
      onClick={() => onSelect(p)}
      style={{
        cursor: 'pointer',
        borderLeft: isFirst ? '3px solid #f59e0b' : beatingReal ? '3px solid #10b981' : ret < 0 ? '3px solid #ef4444' : '3px solid transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: isFirst ? 'rgba(245,158,11,0.05)' : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = isFirst ? 'rgba(245,158,11,0.05)' : 'transparent'; }}
    >
      <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono', fontWeight: 700, color: isFirst ? '#f59e0b' : '#64748b', fontSize: 13 }}>
        {isFirst ? '🥇' : rank}
      </td>
      <td style={{ padding: '10px 8px', fontSize: 13, color: '#f1f5f9', fontWeight: 600, maxWidth: 180 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
      </td>
      <td style={{ padding: '10px 8px' }}>
        <span style={{ padding: '2px 7px', borderRadius: 4, background: typeColor + '20', color: typeColor, fontSize: 10, fontWeight: 700 }}>
          {p.strategy_type?.replace(/_/g, ' ')}
        </span>
      </td>
      <td style={{ padding: '10px 8px' }}><RiskBar level={p.risk_level} /></td>
      <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 13, color: '#f1f5f9' }}>
        £{parseFloat(p.current_value || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
      <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color: retColor }}>
        {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
      </td>
      <td style={{ padding: '10px 8px', fontSize: 12 }}>
        {realReturn != null && (
          <span style={{ color: beatingReal ? '#10b981' : '#ef4444', fontSize: 11, fontWeight: 600 }}>
            {beatingReal ? '+' : ''}{(ret - realReturn).toFixed(2)}%
          </span>
        )}
      </td>
      <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: '#64748b' }}>{p.total_trades}</td>
      <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontSize: 12, color: winRate >= 50 ? '#10b981' : '#94a3b8' }}>{winRate}%</td>
    </tr>
  );
}

export default function PaperTrading() {
  const [leaderboard, setLeaderboard] = useState({ top10: [], bottom10: [], all: [] });
  const [scatter, setScatter] = useState([]);
  const [reco, setReco] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [initing, setIniting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('top'); // top | all | bottom | scatter
  const [realReturn, setRealReturn] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [lbR, saR, recoR, portR] = await Promise.allSettled([
      axios.get(API + '/api/paper/leaderboard'),
      axios.get(API + '/api/paper/strategy-analysis'),
      axios.get(API + '/api/paper/best-recommendation'),
      axios.get(API + '/api/portfolio/summary'),
    ]);
    if (lbR.status === 'fulfilled') setLeaderboard(lbR.value.data);
    if (saR.status === 'fulfilled') setScatter(saR.value.data.scatter || []);
    if (recoR.status === 'fulfilled') setReco(recoR.value.data);
    if (portR.status === 'fulfilled') {
      const s = portR.value.data;
      if (s?.returnPct != null) setRealReturn(parseFloat(s.returnPct));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInit = async () => {
    setIniting(true);
    await axios.post(API + '/api/paper/init').catch(() => {});
    await load();
    setIniting(false);
  };

  const handleSimulate = async () => {
    setSimulating(true);
    await axios.post(API + '/api/paper/run-simulation').catch(() => {});
    await load();
    setSimulating(false);
  };

  const allPortfolios = leaderboard.all || [];
  const notInitialised = !loading && allPortfolios.length === 0;
  const bestReturn = allPortfolios[0]?.total_return_pct;

  const card = (extra = {}) => ({ padding: '20px 22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, ...extra });

  const displayRows = view === 'top' ? leaderboard.top10 : view === 'bottom' ? leaderboard.bottom10 : allPortfolios;

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FlaskConical size={20} color="#8b5cf6" /> Strategy Simulator
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {allPortfolios.length} virtual portfolios running different strategies · cloned from your real T212 holdings
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {notInitialised && (
            <button onClick={handleInit} disabled={initing} style={{ padding: '9px 18px', borderRadius: 10, background: '#8b5cf6', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FlaskConical size={14} style={{ animation: initing ? 'spin 1s linear infinite' : 'none' }} />
              {initing ? 'Initialising…' : 'Initialise 50 Portfolios'}
            </button>
          )}
          {!notInitialised && (
            <button onClick={handleSimulate} disabled={simulating} style={{ padding: '9px 18px', borderRadius: 10, background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Play size={14} style={{ animation: simulating ? 'spin 1s linear infinite' : 'none' }} />
              {simulating ? 'Running…' : 'Run Simulation'}
            </button>
          )}
          <button onClick={load} disabled={loading} style={{ padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {notInitialised ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#475569' }}>
          <FlaskConical size={48} style={{ marginBottom: 20, opacity: 0.3 }} />
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>No Simulations Running</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Click "Initialise 50 Portfolios" to clone your real holdings into 50 virtual portfolios with different strategies</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 600, margin: '0 auto' }}>
            {['Momentum', 'Mean Reversion', 'Signal Following', 'Value', 'Earnings Plays', 'Trend Following'].map(t => (
              <span key={t} style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: '#64748b', fontSize: 12 }}>{t}</span>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Benchmark cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'YOUR REAL PORTFOLIO', value: realReturn != null ? (realReturn >= 0 ? '+' : '') + realReturn.toFixed(2) + '%' : '—', sub: 'Actual T212 return', color: realReturn >= 0 ? '#10b981' : '#ef4444' },
              { label: 'BEST STRATEGY', value: bestReturn != null ? (parseFloat(bestReturn) >= 0 ? '+' : '') + parseFloat(bestReturn).toFixed(2) + '%' : '—', sub: allPortfolios[0]?.name || '—', color: '#f59e0b' },
              { label: 'POTENTIAL GAIN', value: (bestReturn != null && realReturn != null) ? (parseFloat(bestReturn) - realReturn >= 0 ? '+' : '') + (parseFloat(bestReturn) - realReturn).toFixed(2) + '%' : '—', sub: 'vs your real portfolio', color: '#3b82f6' },
              { label: 'SIMULATIONS', value: allPortfolios.length, sub: `${reco?.simulationDays || 0} days of data`, color: '#8b5cf6' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={card({ textAlign: 'center' })}>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>{label}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Main content: leaderboard + scatter chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Leaderboard */}
            <div style={card({ padding: 0, overflow: 'hidden' })}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Strategy Leaderboard</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {[['top', 'Top 10'], ['all', 'All 50'], ['bottom', 'Bottom 10']].map(([k, l]) => (
                    <button key={k} onClick={() => setView(k)} style={{ padding: '4px 10px', borderRadius: 6, background: view === k ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${view === k ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, color: view === k ? '#3b82f6' : '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto', overflowY: view === 'all' ? 'auto' : 'hidden', maxHeight: view === 'all' ? 500 : 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.4)' }}>
                      {['#', 'Strategy', 'Type', 'Risk', 'Value', 'Return', 'vs You', 'Trades', 'Win%'].map(h => (
                        <th key={h} style={{ padding: '9px 8px', textAlign: 'left', fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 1, whiteSpace: 'nowrap', ...(h === '#' ? { paddingLeft: 12 } : {}) }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>Loading…</td></tr>
                    ) : displayRows.map((p, i) => (
                      <LeaderboardRow key={p.id} p={p} rank={view === 'bottom' ? allPortfolios.length - (leaderboard.bottom10?.length || 10) + i + 1 : p.rank} realReturn={realReturn} onSelect={setSelected} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scatter chart: risk vs return */}
            <div style={card({})}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>RISK vs RETURN</div>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>Each dot = one portfolio strategy</div>
              {scatter.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <ScatterChart>
                      <XAxis type="number" dataKey="risk" name="Risk" domain={[0, 11]} tick={{ fontSize: 10, fill: '#475569' }} label={{ value: 'Risk Level', position: 'bottom', fill: '#475569', fontSize: 10 }} />
                      <YAxis type="number" dataKey="return" name="Return" tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={v => v.toFixed(1) + '%'} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                        if (!payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
                            <div style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 4 }}>{d.name}</div>
                            <div style={{ color: TYPE_COLOR[d.type] || '#94a3b8' }}>{d.type}</div>
                            <div style={{ color: '#94a3b8', marginTop: 4 }}>Return: <span style={{ color: d.return >= 0 ? '#10b981' : '#ef4444' }}>{d.return >= 0 ? '+' : ''}{d.return.toFixed(2)}%</span></div>
                            <div style={{ color: '#94a3b8' }}>Risk: {d.risk}/10 · Trades: {d.trades}</div>
                          </div>
                        );
                      }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                      {realReturn != null && <ReferenceLine y={realReturn} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'You', fill: '#f59e0b', fontSize: 10 }} />}
                      {Object.entries(TYPE_COLOR).map(([type, color]) => {
                        const data = scatter.filter(d => d.type === type);
                        return data.length > 0 ? <Scatter key={type} data={data} fill={color} fillOpacity={0.7} r={4} /> : null;
                      })}
                    </ScatterChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {Object.entries(TYPE_COLOR).map(([type, color]) => (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                        <span style={{ fontSize: 10, color: '#64748b' }}>{type.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 40 }}>Run simulation to see data</div>
              )}
            </div>
          </div>

          {/* Recommendation card */}
          {reco && (
            <div style={card({ borderLeft: '3px solid #8b5cf6' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Award size={18} color="#8b5cf6" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>AI Strategy Recommendation</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>Based on {reco.simulationDays} simulation day{reco.simulationDays !== 1 ? 's' : ''}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{reco.recommendation}</p>
              {reco.best?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
                  {reco.best.slice(0, 3).map((p, i) => {
                    const ret = parseFloat(p.total_return_pct || 0);
                    return (
                      <div key={i} style={{ padding: '10px 14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 10 }}>
                        <div style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 700, marginBottom: 4 }}>#{i + 1} TOP STRATEGY</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color: ret >= 0 ? '#10b981' : '#ef4444' }}>{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{p.description}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {selected && <PortfolioModal portfolio={selected} onClose={() => setSelected(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
