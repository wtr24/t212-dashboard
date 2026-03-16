import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell, BarChart, Bar } from 'recharts';
import { FlaskConical, TrendingUp, TrendingDown, Play, RefreshCw, Trophy, AlertTriangle } from 'lucide-react';

const C = {
  gain: '#00ff88', loss: '#ff2d55', neutral: '#ffb700',
  blue: '#3b82f6', muted: 'rgba(255,255,255,0.4)',
  surface: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)',
  bg: '#080d1a'
};

const STRATEGY_COLORS = {
  MOMENTUM: '#3b82f6', MEAN_REVERSION: '#8b5cf6', SIGNALS_ONLY: '#00ff88',
  EARNINGS: '#ffb700', TREND_FOLLOWING: '#06b6d4', VALUE: '#f97316'
};

const fmt = (n, dec) => { dec = dec == null ? 2 : dec; return n == null ? '—' : Number(n).toFixed(dec); };
const fmtPct = (n) => { if (n == null) return '—'; const v = Number(n); return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; };
const fmtGbp = (n) => n == null ? '—' : '£' + Number(n).toLocaleString('en-GB', {minimumFractionDigits:2, maximumFractionDigits:2});

function TradesTab() {
  const [trades, setTrades] = useState([]);
  useEffect(() => {
    fetch('/api/paper/portfolios')
      .then(r => r.json())
      .then(d => {
        const top = d.data && d.data[0];
        if (top) {
          fetch('/api/paper/portfolios/' + top.id)
            .then(r => r.json())
            .then(d => setTrades(d.trades || d.recentTrades || []));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ marginBottom:'0.5rem', color:C.muted, fontSize:'0.65rem', letterSpacing:'0.1em' }}>RECENT TRADES — TOP PERFORMING PORTFOLIO</div>
      <div style={{ border:'1px solid '+C.border, borderRadius:'6px', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'80px 60px 100px 80px 80px 1fr', gap:'8px', padding:'0.5rem 0.75rem', background:C.surface, color:C.muted, fontSize:'0.6rem', letterSpacing:'0.1em' }}>
          <span>ACTION</span><span>TICKER</span><span>PRICE</span><span>VALUE</span><span>P&L</span><span>REASON</span>
        </div>
        {trades.length === 0 && (
          <div style={{ padding:'1rem', color:C.muted, fontSize:'0.75rem', textAlign:'center' }}>No trades yet. Run simulation first.</div>
        )}
        {trades.slice(0,20).map((t,i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'80px 60px 100px 80px 80px 1fr', gap:'8px', padding:'0.5rem 0.75rem', borderTop:'1px solid '+C.border, fontSize:'0.73rem' }}>
            <span style={{ color: t.action==='BUY' ? C.gain : C.loss, fontWeight:700 }}>{t.action}</span>
            <span>{t.ticker}</span>
            <span>£{Number(t.price||0).toFixed(2)}</span>
            <span>£{Number(t.total_value||0).toFixed(0)}</span>
            <span style={{ color: parseFloat(t.pnl||0) > 0 ? C.gain : parseFloat(t.pnl||0) < 0 ? C.loss : C.muted }}>
              {t.pnl ? (parseFloat(t.pnl)>=0?'+':'')+'£'+Number(t.pnl).toFixed(2) : '—'}
            </span>
            <span style={{ color:C.muted, fontSize:'0.65rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PaperTrading() {
  const [leaderboard, setLeaderboard] = useState({ top10:[], bottom10:[], all:[], total:0 });
  const [comparison, setComparison] = useState(null);
  const [strategyAnalysis, setStrategyAnalysis] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simRunning, setSimRunning] = useState(false);
  const [initialising, setInitialising] = useState(false);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [lb, comp, strat, rec] = await Promise.all([
        fetch('/api/paper/leaderboard').then(r=>r.json()).catch(()=>({ top10:[], bottom10:[], all:[], total:0 })),
        fetch('/api/paper/comparison').then(r=>r.json()).catch(()=>null),
        fetch('/api/paper/strategy-analysis').then(r=>r.json()).catch(()=>null),
        fetch('/api/paper/best-recommendation').then(r=>r.json()).catch(()=>null)
      ]);
      setLeaderboard(lb);
      setComparison(comp);
      setStrategyAnalysis(strat);
      setRecommendation(rec);
    } catch(e) { console.error('fetch error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleInit = async () => {
    setInitialising(true);
    try {
      await fetch('/api/paper/init', { method:'POST' });
      await new Promise(r => setTimeout(r, 3000));
      await fetchAll();
    } catch(e) { console.error(e); }
    setInitialising(false);
  };

  const handleRunSim = async () => {
    setSimRunning(true);
    try {
      await fetch('/api/paper/run-simulation', { method:'POST' });
      await new Promise(r => setTimeout(r, 5000));
      await fetchAll();
    } catch(e) { console.error(e); }
    setSimRunning(false);
  };

  const loadDetail = async (portfolioId) => {
    if (selectedPortfolio === portfolioId) {
      setSelectedPortfolio(null);
      setDetailData(null);
      return;
    }
    setSelectedPortfolio(portfolioId);
    try {
      const d = await fetch('/api/paper/portfolios/' + portfolioId).then(r=>r.json());
      setDetailData(d);
    } catch(e) { console.error(e); }
  };

  const noData = !loading && (!leaderboard.top10 || !leaderboard.top10.length);

  if (noData) {
    return (
      <div style={{ padding:'2rem', fontFamily:'JetBrains Mono, monospace', color:'#fff', background:C.bg, minHeight:'100vh' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'2rem' }}>
          <FlaskConical size={24} color={C.neutral} />
          <h1 style={{ fontSize:'1.4rem', fontWeight:700, letterSpacing:'0.05em', fontFamily:'Syne, sans-serif', margin:0 }}>STRATEGY SIMULATOR</h1>
        </div>
        <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'8px', padding:'3rem', textAlign:'center' }}>
          <FlaskConical size={48} color={C.muted} style={{margin:'0 auto 1rem', display:'block'}} />
          <p style={{ color:C.muted, marginBottom:'1.5rem', fontSize:'0.9rem' }}>No simulation data found. Initialise 50 virtual portfolios cloned from your real holdings.</p>
          <button onClick={handleInit} disabled={initialising}
            style={{ background:initialising?C.surface:C.gain, color:initialising?C.muted:'#000', border:'none', padding:'0.75rem 2rem', borderRadius:'6px', fontFamily:'JetBrains Mono, monospace', fontWeight:700, cursor:initialising?'not-allowed':'pointer', fontSize:'0.85rem' }}>
            {initialising ? 'INITIALISING 50 PORTFOLIOS...' : 'INITIALISE SIMULATION'}
          </button>
        </div>
      </div>
    );
  }

  const yourReturn = comparison ? comparison.yourReturn : 0;
  const yourRank = comparison ? comparison.yourRank : '?';
  const totalCount = comparison ? comparison.totalPortfolios : 51;
  const bestPortfolio = leaderboard.top10 && leaderboard.top10[0];

  return (
    <div style={{ padding:'1.5rem', fontFamily:'JetBrains Mono, monospace', color:'#fff', background:C.bg, minHeight:'100vh' }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <FlaskConical size={20} color={C.neutral} />
          <span style={{ fontFamily:'Syne, sans-serif', fontSize:'1.2rem', fontWeight:700, letterSpacing:'0.08em' }}>STRATEGY SIMULATOR</span>
          <span style={{ color:C.muted, fontSize:'0.75rem' }}>50 PORTFOLIOS · LIVE SIGNALS</span>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={fetchAll} style={{ background:C.surface, border:'1px solid '+C.border, color:C.muted, padding:'0.4rem 0.8rem', borderRadius:'4px', cursor:'pointer', fontSize:'0.75rem', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
            <RefreshCw size={12} /> REFRESH
          </button>
          <button onClick={handleRunSim} disabled={simRunning}
            style={{ background:simRunning?C.surface:C.gain, color:simRunning?C.muted:'#000', border:'none', padding:'0.4rem 0.8rem', borderRadius:'4px', cursor:simRunning?'not-allowed':'pointer', fontSize:'0.75rem', fontFamily:'inherit', fontWeight:700, display:'flex', alignItems:'center', gap:'4px' }}>
            <Play size={12} /> {simRunning ? 'RUNNING...' : 'RUN SIM'}
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px', marginBottom:'1.5rem' }}>
        {[
          { label:'YOUR REAL RETURN', value: fmtPct(yourReturn), color: yourReturn >= 0 ? C.gain : C.loss },
          { label:'YOUR RANK', value: yourRank + ' / ' + totalCount, color: yourRank <= 10 ? C.gain : yourRank >= totalCount-10 ? C.loss : C.neutral },
          { label:'BEST STRATEGY', value: bestPortfolio ? fmtPct(bestPortfolio.total_return_pct) : '—', color: C.gain },
          { label:'PORTFOLIOS BEATING YOU', value: comparison ? (yourRank - 1) : '—', color: C.neutral },
          { label:'TOTAL PORTFOLIOS', value: leaderboard.total || '—', color: C.blue }
        ].map((kpi,i) => (
          <div key={i} style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'6px', padding:'0.75rem 1rem' }}>
            <div style={{ color:C.muted, fontSize:'0.6rem', letterSpacing:'0.1em', marginBottom:'0.4rem' }}>{kpi.label}</div>
            <div style={{ color:kpi.color, fontSize:'1.1rem', fontWeight:700 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {recommendation && recommendation.recommendation && (
        <div style={{ background:'rgba(255,183,0,0.08)', border:'1px solid rgba(255,183,0,0.3)', borderRadius:'6px', padding:'0.75rem 1rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'12px' }}>
          <Trophy size={16} color={C.neutral} />
          <span style={{ fontSize:'0.8rem', color:C.neutral }}>{recommendation.recommendation}</span>
        </div>
      )}

      <div style={{ display:'flex', gap:'0', marginBottom:'1rem', borderBottom:'1px solid '+C.border }}>
        {['leaderboard','strategies','scatter','trades'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ background:'none', border:'none', borderBottom:activeTab===tab?'2px solid '+C.gain:'2px solid transparent', color:activeTab===tab?C.gain:C.muted, padding:'0.5rem 1rem', cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:activeTab===tab?700:400, marginBottom:'-1px' }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'leaderboard' && (
        <div>
          <div style={{ marginBottom:'0.5rem', color:C.muted, fontSize:'0.65rem', letterSpacing:'0.1em' }}>TOP 10 STRATEGIES</div>
          <div style={{ border:'1px solid '+C.border, borderRadius:'6px', overflow:'hidden', marginBottom:'2rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'40px 1fr 120px 80px 90px 80px 80px 60px', gap:'8px', padding:'0.5rem 0.75rem', background:C.surface, color:C.muted, fontSize:'0.6rem', letterSpacing:'0.1em' }}>
              <span>#</span><span>STRATEGY</span><span>TYPE</span><span>RISK</span><span>RETURN</span><span>vs YOU</span><span>WIN RATE</span><span>TRADES</span>
            </div>
            {(leaderboard.top10 || []).map((p, i) => {
              const returnPct = parseFloat(p.total_return_pct || 0);
              const vsReal = returnPct - yourReturn;
              const winRate = p.total_trades > 0 ? (p.winning_trades / p.total_trades * 100).toFixed(0) : 0;
              const isExpanded = expandedRow === p.id;
              return (
                <div key={p.id}>
                  <div
                    onClick={() => { setExpandedRow(isExpanded ? null : p.id); loadDetail(p.id); }}
                    style={{ display:'grid', gridTemplateColumns:'40px 1fr 120px 80px 90px 80px 80px 60px', gap:'8px', padding:'0.6rem 0.75rem', borderTop:'1px solid '+C.border, cursor:'pointer', background:i===0?'rgba(0,255,136,0.04)':'transparent', borderLeft:i===0?'2px solid '+C.gain:vsReal>0?'2px solid rgba(0,255,136,0.3)':'2px solid transparent' }}>
                    <span style={{ color:i===0?C.gain:C.muted, fontSize:'0.75rem', fontWeight:i===0?700:400 }}>{i===0?'▲':(i+1)}</span>
                    <span style={{ fontSize:'0.78rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize:'0.65rem', color:STRATEGY_COLORS[p.strategy_type]||C.blue }}>{p.strategy_type ? p.strategy_type.replace(/_/g,' ') : '—'}</span>
                    <span style={{ fontSize:'0.72rem' }}>{'█'.repeat(Math.min(p.risk_level||1,10))}{'░'.repeat(Math.max(0,10-(p.risk_level||1)))}</span>
                    <span style={{ color:returnPct>=0?C.gain:C.loss, fontSize:'0.85rem', fontWeight:700 }}>{fmtPct(returnPct)}</span>
                    <span style={{ color:vsReal>=0?C.gain:C.loss, fontSize:'0.75rem' }}>{vsReal>=0?'+':''}{vsReal.toFixed(2)}%</span>
                    <span style={{ color:winRate>=55?C.gain:winRate>=45?C.neutral:C.loss, fontSize:'0.75rem' }}>{winRate}%</span>
                    <span style={{ color:C.muted, fontSize:'0.75rem' }}>{p.total_trades}</span>
                  </div>
                  {isExpanded && detailData && selectedPortfolio === p.id && (
                    <div style={{ background:'rgba(0,0,0,0.3)', padding:'1rem', borderTop:'1px solid '+C.border }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                        <div>
                          <div style={{ color:C.muted, fontSize:'0.65rem', letterSpacing:'0.1em', marginBottom:'0.5rem' }}>CURRENT POSITIONS ({(detailData.positions||[]).length})</div>
                          {(detailData.positions||[]).slice(0,6).map(pos => (
                            <div key={pos.ticker} style={{ display:'flex', justifyContent:'space-between', padding:'0.3rem 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:'0.75rem' }}>
                              <span>{pos.ticker}</span>
                              <span style={{ color:parseFloat(pos.unrealised_pnl_pct||0)>=0?C.gain:C.loss }}>
                                {fmtPct(pos.unrealised_pnl_pct)} ({fmtGbp(pos.current_value)})
                              </span>
                            </div>
                          ))}
                          {(detailData.positions||[]).length === 0 && <div style={{ color:C.muted, fontSize:'0.7rem' }}>No open positions</div>}
                        </div>
                        <div>
                          <div style={{ color:C.muted, fontSize:'0.65rem', letterSpacing:'0.1em', marginBottom:'0.5rem' }}>RECENT TRADES</div>
                          {(detailData.recentTrades||detailData.trades||[]).slice(0,5).map((t,ti) => (
                            <div key={ti} style={{ display:'flex', justifyContent:'space-between', padding:'0.3rem 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:'0.72rem' }}>
                              <span><span style={{ color:t.action==='BUY'?C.gain:C.loss }}>{t.action}</span> {t.ticker} @{t.price}</span>
                              <span style={{ color:C.muted, fontSize:'0.65rem', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'160px' }}>{(t.reason||'').slice(0,40)}</span>
                            </div>
                          ))}
                          {(detailData.recentTrades||detailData.trades||[]).length === 0 && <div style={{ color:C.muted, fontSize:'0.7rem' }}>No trades yet</div>}
                        </div>
                      </div>
                      {detailData.snapshots && detailData.snapshots.length > 1 && (
                        <div style={{ marginTop:'1rem', height:80 }}>
                          <div style={{ color:C.muted, fontSize:'0.65rem', letterSpacing:'0.1em', marginBottom:'0.3rem' }}>PORTFOLIO VALUE OVER TIME</div>
                          <ResponsiveContainer width='100%' height={70}>
                            <LineChart data={detailData.snapshots}>
                              <Line type='monotone' dataKey='total_value' stroke={C.gain} dot={false} strokeWidth={1.5} />
                              <Tooltip contentStyle={{ background:'#0d1929', border:'1px solid '+C.border, fontSize:'0.7rem', fontFamily:'JetBrains Mono' }} formatter={(v) => ['£'+Number(v).toFixed(0), 'Value']} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ border:'1px solid rgba(59,130,246,0.4)', borderRadius:'6px', padding:'0.6rem 0.75rem', marginBottom:'1rem', display:'grid', gridTemplateColumns:'40px 1fr 120px 80px 90px 80px 80px 60px', gap:'8px', background:'rgba(59,130,246,0.05)' }}>
            <span style={{ color:C.blue, fontSize:'0.75rem', fontWeight:700 }}>★</span>
            <span style={{ fontSize:'0.78rem', color:C.blue }}>YOUR REAL PORTFOLIO</span>
            <span style={{ fontSize:'0.65rem', color:C.muted }}>REAL</span>
            <span style={{ fontSize:'0.75rem', color:C.muted }}>—</span>
            <span style={{ color:yourReturn>=0?C.gain:C.loss, fontSize:'0.85rem', fontWeight:700 }}>{fmtPct(yourReturn)}</span>
            <span style={{ color:C.blue, fontSize:'0.75rem' }}>baseline</span>
            <span style={{ color:C.muted, fontSize:'0.75rem' }}>—</span>
            <span style={{ color:C.muted, fontSize:'0.75rem' }}>manual</span>
          </div>

          <div style={{ marginBottom:'0.5rem', color:C.muted, fontSize:'0.65rem', letterSpacing:'0.1em' }}>WORST PERFORMING (avoid these strategies)</div>
          <div style={{ border:'1px solid '+C.border, borderRadius:'6px', overflow:'hidden' }}>
            {(leaderboard.bottom10||[]).slice(0,5).map((p, i) => {
              const returnPct = parseFloat(p.total_return_pct || 0);
              return (
                <div key={p.id} style={{ display:'grid', gridTemplateColumns:'40px 1fr 120px 80px 90px', gap:'8px', padding:'0.5rem 0.75rem', borderTop:i>0?'1px solid '+C.border:'none', borderLeft:'2px solid rgba(255,45,85,0.3)', fontSize:'0.75rem' }}>
                  <span style={{ color:C.muted }}>↓{i+1}</span>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  <span style={{ color:STRATEGY_COLORS[p.strategy_type], fontSize:'0.65rem' }}>{p.strategy_type ? p.strategy_type.replace(/_/g,' ') : '—'}</span>
                  <span>{'█'.repeat(Math.min(p.risk_level||1,10))}{'░'.repeat(Math.max(0,10-(p.risk_level||1)))}</span>
                  <span style={{ color:C.loss, fontWeight:700 }}>{fmtPct(returnPct)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'strategies' && strategyAnalysis && (
        <div>
          <div style={{ marginBottom:'0.5rem', color:C.muted, fontSize:'0.65rem', letterSpacing:'0.1em' }}>AVERAGE RETURN BY STRATEGY TYPE</div>
          <div style={{ height:220, marginBottom:'2rem' }}>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={strategyAnalysis.byStrategy} margin={{ top:5, right:10, bottom:5, left:0 }}>
                <XAxis dataKey='strategy_type' tick={{ fill:C.muted, fontSize:9, fontFamily:'JetBrains Mono' }} tickFormatter={v=>v.replace(/_/g,' ')} />
                <YAxis tick={{ fill:C.muted, fontSize:9, fontFamily:'JetBrains Mono' }} tickFormatter={v=>v+'%'} />
                <Tooltip contentStyle={{ background:'#0d1929', border:'1px solid '+C.border, fontSize:'0.7rem', fontFamily:'JetBrains Mono' }} formatter={(v,n) => [v+'%', n]} />
                <Bar dataKey='avg_return' radius={[3,3,0,0]}>
                  {(strategyAnalysis.byStrategy||[]).map((entry, i) => (
                    <Cell key={i} fill={STRATEGY_COLORS[entry.strategy_type] || C.blue} opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ border:'1px solid '+C.border, borderRadius:'6px', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 60px 90px 80px 80px 80px', gap:'8px', padding:'0.5rem 0.75rem', background:C.surface, color:C.muted, fontSize:'0.6rem', letterSpacing:'0.1em' }}>
              <span>STRATEGY TYPE</span><span>COUNT</span><span>AVG RETURN</span><span>BEST</span><span>WORST</span><span>WIN RATE</span>
            </div>
            {(strategyAnalysis.byStrategy||[]).map((s, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 60px 90px 80px 80px 80px', gap:'8px', padding:'0.5rem 0.75rem', borderTop:'1px solid '+C.border, fontSize:'0.75rem', borderLeft:'2px solid '+(STRATEGY_COLORS[s.strategy_type]||C.blue) }}>
                <span style={{ color:STRATEGY_COLORS[s.strategy_type]||C.blue }}>{s.strategy_type ? s.strategy_type.replace(/_/g,' ') : '—'}</span>
                <span style={{ color:C.muted }}>{s.count}</span>
                <span style={{ color:parseFloat(s.avg_return)>=0?C.gain:C.loss, fontWeight:700 }}>{fmtPct(s.avg_return)}</span>
                <span style={{ color:C.gain }}>{fmtPct(s.best_return)}</span>
                <span style={{ color:C.loss }}>{fmtPct(s.worst_return)}</span>
                <span style={{ color:parseFloat(s.avg_win_rate)>=50?C.gain:C.loss }}>{s.avg_win_rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'scatter' && strategyAnalysis && (
        <div>
          <div style={{ marginBottom:'0.5rem', color:C.muted, fontSize:'0.65rem', letterSpacing:'0.1em' }}>RISK LEVEL vs RETURN % — Find the optimal risk/reward zone</div>
          <div style={{ height:320, marginBottom:'1rem' }}>
            <ResponsiveContainer width='100%' height='100%'>
              <ScatterChart margin={{ top:10, right:20, bottom:30, left:10 }}>
                <XAxis dataKey='risk' name='Risk' type='number' domain={[1,10]} tick={{ fill:C.muted, fontSize:9, fontFamily:'JetBrains Mono' }} label={{ value:'RISK LEVEL', position:'insideBottom', offset:-15, fill:C.muted, fontSize:9 }} />
                <YAxis dataKey='return' name='Return' tick={{ fill:C.muted, fontSize:9, fontFamily:'JetBrains Mono' }} tickFormatter={v=>v+'%'} />
                <ZAxis range={[40,80]} />
                <Tooltip
                  cursor={{ strokeDasharray:'3 3' }}
                  content={({active, payload}) => active && payload && payload[0] ? (
                    <div style={{ background:'#0d1929', border:'1px solid rgba(255,255,255,0.1)', padding:'8px 12px', borderRadius:'6px', fontSize:'0.7rem' }}>
                      <div style={{ fontWeight:700, marginBottom:'4px' }}>{payload[0].payload.name}</div>
                      <div>Risk: {payload[0].payload.risk}/10</div>
                      <div style={{ color:parseFloat(payload[0].payload.return)>=0?C.gain:C.loss }}>Return: {fmtPct(payload[0].payload.return)}</div>
                      <div style={{ color:STRATEGY_COLORS[payload[0].payload.type]||C.blue }}>{payload[0].payload.type}</div>
                    </div>
                  ) : null}
                />
                <Scatter data={strategyAnalysis.scatter}>
                  {(strategyAnalysis.scatter||[]).map((entry, i) => (
                    <Cell key={i} fill={STRATEGY_COLORS[entry.type || entry.strategy_type] || C.blue} opacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
            {Object.entries(STRATEGY_COLORS).map(([type, color]) => (
              <div key={type} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.65rem', color:C.muted }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:color }} />
                {type.replace(/_/g,' ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'trades' && <TradesTab />}
    </div>
  );
}
