import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, RefreshCw, ExternalLink,
  TrendingUp, BarChart3, Brain, Building2, Eye, FileText, Target, Activity, Zap,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5002';
const fmt = (n, d = 2) => n != null ? Number(n).toFixed(d) : '—';
const fmtPct = n => n != null ? `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}%` : '—';
const fmtBig = n => {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${Number(n).toFixed(2)}`;
};
const fmtPrice = n => n != null ? `$${Number(n).toFixed(2)}` : '—';
const timeAgo = dt => {
  if (!dt) return '';
  const diff = (Date.now() - new Date(dt)) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};
const sentColor = s => s === 'POSITIVE' ? '#10b981' : s === 'NEGATIVE' ? '#ef4444' : '#94a3b8';
const sigColor = s => {
  const u = (s || '').toUpperCase();
  if (u.includes('BUY') || u.includes('BULL')) return '#10b981';
  if (u.includes('SELL') || u.includes('BEAR')) return '#ef4444';
  return '#f59e0b';
};
const gradeColor = g => ({ A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ef4444', F: '#7f1d1d' })[(g || '').charAt(0).toUpperCase()] || '#94a3b8';
const recColor = r => { const s = (r || '').toLowerCase(); if (s.includes('buy') || s.includes('outperform')) return '#10b981'; if (s.includes('sell') || s.includes('under')) return '#ef4444'; return '#f59e0b'; };

const card = { background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 };

function MetricCard({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#e2e8f0' }}>{value}</div>
    </div>
  );
}

function SurprisePill({ pct }) {
  if (pct == null) return <span style={{ color: '#64748b', fontSize: 12 }}>—</span>;
  const pos = pct > 0;
  return <span style={{ fontSize: 12, fontWeight: 600, color: pos ? '#10b981' : '#ef4444', background: pos ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '2px 6px' }}>{pos ? '+' : ''}{Number(pct).toFixed(1)}%</span>;
}

function AnalystBar({ strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0 }) {
  const total = strongBuy + buy + hold + sell + strongSell;
  if (!total) return <div style={{ color: '#64748b', fontSize: 12 }}>No analyst data</div>;
  const segs = [['Strong Buy', strongBuy, '#10b981'], ['Buy', buy, '#34d399'], ['Hold', hold, '#f59e0b'], ['Sell', sell, '#f87171'], ['Strong Sell', strongSell, '#ef4444']].filter(s => s[1] > 0);
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1, marginBottom: 8 }}>
        {segs.map(([l, n, c]) => <div key={l} style={{ flex: n, background: c }} title={`${l}: ${n}`} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {segs.map(([l, n, c]) => (
          <div key={l} style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
            {l}: {n} ({Math.round(n / total * 100)}%)
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'earnings', label: 'Earnings', icon: TrendingUp },
  { id: 'financials', label: 'Financials', icon: Activity },
  { id: 'technical', label: 'Technical', icon: Zap },
  { id: 'news', label: 'News', icon: FileText },
  { id: 'congress', label: 'Congress', icon: Building2 },
  { id: 'insider', label: 'Insider', icon: Eye },
  { id: 'ai', label: 'AI Analysis', icon: Brain },
];

export default function Research() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [newsFilter, setNewsFilter] = useState('all');

  useEffect(() => { if (ticker) load(); }, [ticker]);

  async function load(force = false) {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/api/research/${(ticker || '').toUpperCase()}${force ? '?refresh=true' : ''}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleRefresh() { setRefreshing(true); await load(true); setRefreshing(false); }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#64748b', fontSize: 14 }}>Building research report for {ticker?.toUpperCase()}…</div>
      <div style={{ color: '#475569', fontSize: 12 }}>Fetching Yahoo Finance, analyst data, congress trades…</div>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>
      <button onClick={() => load()} style={{ padding: '8px 20px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', cursor: 'pointer' }}>Retry</button>
    </div>
  );

  const d = data || {};
  const price = d.price || {};
  const up = (price.changePercent || 0) >= 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* HERO */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
            <ArrowLeft size={13} /> Back
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', cursor: 'pointer', fontSize: 13, opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Company */}
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(139,92,246,0.3))', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#3b82f6', fontFamily: 'JetBrains Mono' }}>
                {(ticker || '').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 21, fontWeight: 800, color: '#e2e8f0' }}>{d.company?.name || ticker}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', borderRadius: 6, padding: '2px 8px' }}>{ticker?.toUpperCase()}</span>
                  {d.company?.sector && <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 8px' }}>{d.company.sector}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Price */}
          <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: 38, fontWeight: 800, color: '#e2e8f0', fontFamily: 'JetBrains Mono', lineHeight: 1 }}>{fmtPrice(price.price)}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              {up ? <ArrowUpRight size={16} color="#10b981" /> : <ArrowDownRight size={16} color="#ef4444" />}
              <span style={{ fontSize: 15, fontWeight: 600, color: up ? '#10b981' : '#ef4444' }}>
                {fmtPrice(price.change)} ({fmtPct(price.changePercent != null ? price.changePercent * 100 : null)})
              </span>
            </div>
          </div>

          {/* Grade + signal */}
          {d.technical && (
            <div style={{ flex: '0 0 auto', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: gradeColor(d.technical.grade) + '20', border: `2px solid ${gradeColor(d.technical.grade)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: gradeColor(d.technical.grade), fontFamily: 'JetBrains Mono' }}>
                  {d.technical.grade || '?'}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>TA Grade</div>
              </div>
              <div style={{ padding: '10px 16px', borderRadius: 12, background: sigColor(d.technical.signal) + '20', border: `1px solid ${sigColor(d.technical.signal)}50`, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: sigColor(d.technical.signal) }}>{(d.technical.signal || 'NEUTRAL').toUpperCase()}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Signal</div>
              </div>
            </div>
          )}
        </div>

        {/* 52w bar */}
        {d.metrics?.week52Low && d.metrics?.week52High && price.price && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
              <span>52W Low {fmtPrice(d.metrics.week52Low)}</span>
              <span>52W High {fmtPrice(d.metrics.week52High)}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, height: '100%', borderRadius: 3, width: `${Math.min(100, Math.max(0, (price.price - d.metrics.week52Low) / (d.metrics.week52High - d.metrics.week52Low) * 100))}%`, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)' }} />
            </div>
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(15,23,42,0.6)', borderRadius: 12, padding: 6, border: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, background: active ? 'rgba(59,130,246,0.2)' : 'transparent', color: active ? '#3b82f6' : '#64748b', transition: 'all 0.15s' }}>
              <Icon size={13} />{t.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {tab === 'overview' && <OverviewTab d={d} price={price} />}
      {tab === 'earnings' && <EarningsTab d={d} />}
      {tab === 'financials' && <FinancialsTab d={d} />}
      {tab === 'technical' && <TechnicalTab d={d} />}
      {tab === 'news' && <NewsTab d={d} newsFilter={newsFilter} setNewsFilter={setNewsFilter} />}
      {tab === 'congress' && <CongressTab d={d} ticker={ticker} />}
      {tab === 'insider' && <InsiderTab d={d} ticker={ticker} />}
      {tab === 'ai' && <AiTab d={d} />}
    </div>
  );
}

function OverviewTab({ d, price }) {
  const ai = d.aiVerdict;
  const analyst = d.analyst || {};
  const m = d.metrics || {};
  const total = (analyst.strongBuy || 0) + (analyst.buy || 0) + (analyst.hold || 0) + (analyst.sell || 0) + (analyst.strongSell || 0);
  const upside = analyst.targetPrice && price.price ? (analyst.targetPrice - price.price) / price.price * 100 : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {ai && (
        <div style={{ ...card, border: `1px solid ${sigColor(ai.signal)}30` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Brain size={16} color="#8b5cf6" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>AI Analysis — Is {d.ticker} a BUY or SELL?</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>Powered by Gemini</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ padding: '10px 24px', borderRadius: 12, background: sigColor(ai.signal) + '20', border: `1px solid ${sigColor(ai.signal)}50` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: sigColor(ai.signal) }}>{(ai.signal || '').toUpperCase()}</div>
            </div>
            {ai.confidence && <MetricCard label="Confidence" value={`${ai.confidence}%`} />}
            {ai.beatProbability && <MetricCard label="Beat Prob." value={`${ai.beatProbability}%`} color="#3b82f6" />}
          </div>
          {ai.summary && <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.75, marginBottom: 16 }}>{ai.summary}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(ai.keyFactors || []).length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981', marginBottom: 8 }}>Bull Case</div>
                {ai.keyFactors.map((f, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: '#94a3b8' }}><span style={{ color: '#10b981' }}>✓</span>{f}</div>)}
              </div>
            )}
            {(ai.risks || []).length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>Bear Case</div>
                {ai.risks.map((r, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: '#94a3b8' }}><span style={{ color: '#ef4444' }}>✗</span>{r}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 10 }}>
        <MetricCard label="Market Cap" value={fmtBig(m.marketCap)} />
        <MetricCard label="P/E Ratio" value={m.pe ? fmt(m.pe, 1) : '—'} />
        <MetricCard label="Forward P/E" value={m.forwardPE ? fmt(m.forwardPE, 1) : '—'} />
        <MetricCard label="PEG" value={m.peg ? fmt(m.peg, 2) : '—'} />
        <MetricCard label="Revenue Growth" value={m.revenueGrowth ? fmtPct(m.revenueGrowth * 100) : '—'} color={m.revenueGrowth > 0 ? '#10b981' : m.revenueGrowth < 0 ? '#ef4444' : undefined} />
        <MetricCard label="Profit Margin" value={m.profitMargin ? fmtPct(m.profitMargin * 100) : '—'} />
        <MetricCard label="Beta" value={m.beta ? fmt(m.beta, 2) : '—'} />
        <MetricCard label="Div. Yield" value={m.dividendYield ? fmtPct(m.dividendYield * 100) : 'None'} />
      </div>

      {analyst.recommendation && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Target size={15} color="#94a3b8" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Analyst Consensus</span>
            {total > 0 && <span style={{ fontSize: 12, color: '#64748b' }}>({total} analysts)</span>}
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: recColor(analyst.recommendation), textTransform: 'uppercase' }}>{analyst.recommendation?.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Consensus</div>
            </div>
            {analyst.targetPrice && (
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>{fmtPrice(analyst.targetPrice)}</div>
                <div style={{ fontSize: 12, color: upside >= 0 ? '#10b981' : '#ef4444' }}>
                  Target {upside != null ? `(${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%)` : ''}
                </div>
              </div>
            )}
            {analyst.targetLow && analyst.targetHigh && (
              <div style={{ fontSize: 12, color: '#64748b' }}>Range: {fmtPrice(analyst.targetLow)} — {fmtPrice(analyst.targetHigh)}</div>
            )}
          </div>
          <AnalystBar {...analyst} />
          {(analyst.recentUpgrades || []).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Recent Changes</div>
              {analyst.recentUpgrades.map((u, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontWeight: 600, color: '#e2e8f0', flex: '0 0 140px', overflow: 'hidden' }}>{u.firm}</span>
                  <span style={{ color: '#ef4444' }}>{u.fromGrade || '—'}</span>
                  <span>→</span>
                  <span style={{ color: '#10b981' }}>{u.toGrade}</span>
                  <span style={{ marginLeft: 'auto', color: '#475569' }}>{u.date ? new Date(u.date * 1000).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <TrendingUp size={15} color="#94a3b8" />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Earnings Snapshot</span>
        </div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
          {d.beatRate != null && <div><div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6' }}>{d.beatRate}%</div><div style={{ fontSize: 12, color: '#64748b' }}>Beat Rate ({d.earningsHistory?.length || 0}Q)</div></div>}
          {d.avgSurprisePct != null && <div><div style={{ fontSize: 32, fontWeight: 800, color: d.avgSurprisePct >= 0 ? '#10b981' : '#ef4444' }}>{d.avgSurprisePct >= 0 ? '+' : ''}{d.avgSurprisePct}%</div><div style={{ fontSize: 12, color: '#64748b' }}>Avg EPS Surprise</div></div>}
          {d.nextEarningsDate && <div><div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{new Date(d.nextEarningsDate * 1000).toLocaleDateString()}</div><div style={{ fontSize: 12, color: '#64748b' }}>Next Earnings</div></div>}
        </div>
        {(d.revenueHistory || []).length > 0 && (
          <div style={{ height: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...d.revenueHistory].reverse().slice(0, 6)} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="totalRevenue" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Tooltip formatter={v => [fmtBig(v), 'Revenue']} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {d.company?.description && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>About {d.company?.name}</div>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.75 }}>{d.company.description.slice(0, 600)}{d.company.description.length > 600 ? '…' : ''}</p>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {d.company?.employees && <span style={{ fontSize: 12, color: '#64748b' }}>👥 {d.company.employees.toLocaleString()} employees</span>}
            {d.company?.website && <a href={d.company.website} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink size={11} /> Website</a>}
          </div>
        </div>
      )}
    </div>
  );
}

function EarningsTab({ d }) {
  const history = d.earningsHistory || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {history.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>EPS: Actual vs Estimate</div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...history].reverse()} barCategoryGap="20%" margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={v => [`$${Number(v).toFixed(2)}`, '']} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Bar dataKey="epsEstimate" name="Estimate" fill="rgba(59,130,246,0.4)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="epsActual" name="Actual" radius={[3, 3, 0, 0]}>
                  {[...history].reverse().map((e, i) => <Cell key={i} fill={e.epsSurprisePct > 0 ? '#10b981' : e.epsSurprisePct < 0 ? '#ef4444' : '#94a3b8'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>Earnings History</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Quarter', 'EPS Est.', 'EPS Actual', 'Surprise', 'Surprise %'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[...history].reverse().map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono', fontSize: 12, color: '#94a3b8' }}>{e.quarter}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{e.epsEstimate != null ? `$${Number(e.epsEstimate).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: e.epsSurprisePct > 0 ? '#10b981' : e.epsSurprisePct < 0 ? '#ef4444' : '#e2e8f0' }}>{e.epsActual != null ? `$${Number(e.epsActual).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{e.epsSurprise != null ? `$${Number(e.epsSurprise).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '10px 12px' }}><SurprisePill pct={e.epsSurprisePct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {d.estimates && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>Next Quarter Estimates</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 10 }}>
            <MetricCard label="EPS Estimate" value={d.estimates.epsEstimate != null ? `$${Number(d.estimates.epsEstimate).toFixed(2)}` : '—'} />
            <MetricCard label="EPS Low" value={d.estimates.epsEstimateLow != null ? `$${Number(d.estimates.epsEstimateLow).toFixed(2)}` : '—'} />
            <MetricCard label="EPS High" value={d.estimates.epsEstimateHigh != null ? `$${Number(d.estimates.epsEstimateHigh).toFixed(2)}` : '—'} />
            <MetricCard label="Revenue Est." value={fmtBig(d.estimates.revenueEstimate)} />
            <MetricCard label="# Analysts" value={d.estimates.analystCount || '—'} />
            <MetricCard label="EPS Growth Est." value={d.estimates.growthEstimate != null ? fmtPct(d.estimates.growthEstimate * 100) : '—'} />
          </div>
        </div>
      )}
    </div>
  );
}

function FinancialsTab({ d }) {
  const rev = [...(d.revenueHistory || [])].reverse();
  const m = d.metrics || {};
  const metricMap = { marketCap: 'Market Cap', pe: 'P/E', forwardPE: 'Fwd P/E', peg: 'PEG', beta: 'Beta', dividendYield: 'Div Yield', profitMargin: 'Profit Margin', revenueGrowth: 'Rev Growth', debtToEquity: 'D/E Ratio', roe: 'ROE', week52High: '52W High', week52Low: '52W Low' };
  const pctKeys = ['dividendYield', 'profitMargin', 'revenueGrowth', 'roe'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {rev.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>Revenue by Quarter</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rev} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => fmtBig(v)} />
                <Tooltip formatter={v => [fmtBig(v), '']} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="totalRevenue" name="Revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="grossProfit" name="Gross Profit" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="netIncome" name="Net Income" radius={[3, 3, 0, 0]}>
                  {rev.map((e, i) => <Cell key={i} fill={(e.netIncome || 0) >= 0 ? '#10b981' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>Key Ratios</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 10 }}>
          {Object.entries(m).filter(([, v]) => v != null).map(([k, v]) => {
            const label = metricMap[k] || k;
            let display = String(v);
            if (k === 'marketCap') display = fmtBig(v);
            else if (pctKeys.includes(k)) display = fmtPct(v * 100);
            else if (typeof v === 'number') display = fmt(v, 2);
            return <MetricCard key={k} label={label} value={display} />;
          })}
        </div>
      </div>
      {rev.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>Income Statement (Quarterly)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Period', 'Revenue', 'Gross Profit', 'Net Income', 'Net Margin'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rev.slice(0, 8).map((r, i) => {
                  const margin = r.totalRevenue && r.netIncome ? r.netIncome / r.totalRevenue * 100 : null;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', color: '#94a3b8', fontFamily: 'JetBrains Mono', fontSize: 12 }}>{r.date}</td>
                      <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{fmtBig(r.totalRevenue)}</td>
                      <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{fmtBig(r.grossProfit)}</td>
                      <td style={{ padding: '10px 12px', color: (r.netIncome || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmtBig(r.netIncome)}</td>
                      <td style={{ padding: '10px 12px' }}><SurprisePill pct={margin} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TechnicalTab({ d }) {
  const ta = d.technical;
  if (!ta) return <div style={{ ...card, color: '#64748b', textAlign: 'center', padding: 40 }}>No technical analysis available. Data refreshes hourly during market hours (Mon–Fri 9am–5pm London).</div>;
  const inds = [
    { n: 'RSI (14)', v: ta.rsi?.toFixed(1), c: ta.rsi > 70 ? '#ef4444' : ta.rsi < 30 ? '#10b981' : '#f59e0b' },
    { n: 'MACD', v: ta.macdTrend, c: sigColor(ta.macdTrend) },
    { n: 'Bollinger', v: ta.bollingerPosition, c: sigColor(ta.bollingerPosition) },
    { n: 'MA 50', v: fmtPrice(ta.ma50), c: '#94a3b8' },
    { n: 'MA 200', v: fmtPrice(ta.ma200), c: '#94a3b8' },
    { n: 'Golden Cross', v: ta.goldenCross ? 'YES' : 'NO', c: ta.goldenCross ? '#10b981' : '#64748b' },
    { n: 'Death Cross', v: ta.deathCross ? 'YES' : 'NO', c: ta.deathCross ? '#ef4444' : '#64748b' },
    { n: 'Volume Ratio', v: ta.volumeRatio?.toFixed(2), c: '#94a3b8' },
    { n: 'ATR %', v: ta.atrPct?.toFixed(2) + '%', c: '#94a3b8' },
    { n: 'Trend', v: ta.trend, c: sigColor(ta.trend) },
    { n: 'Support', v: fmtPrice(ta.nearestSupport), c: '#10b981' },
    { n: 'Resistance', v: fmtPrice(ta.nearestResistance), c: '#ef4444' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 68, height: 68, borderRadius: '50%', background: gradeColor(ta.grade) + '20', border: `3px solid ${gradeColor(ta.grade)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: gradeColor(ta.grade), fontFamily: 'JetBrains Mono', flexShrink: 0 }}>
          {ta.grade || '?'}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: sigColor(ta.signal) }}>{(ta.signal || '').toUpperCase()}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Score: {ta.score}/100 · {ta.trend}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Analysed: {ta.analysedAt ? new Date(ta.analysedAt).toLocaleString() : '—'}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 10 }}>
        {inds.map(i => (
          <div key={i.n} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{i.n}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: i.c }}>{i.v || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsTab({ d, newsFilter, setNewsFilter }) {
  const all = d.news || [];
  const filtered = newsFilter === 'all' ? all : all.filter(n => n.sentiment === newsFilter.toUpperCase());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {['all', 'positive', 'negative', 'neutral'].map(f => (
          <button key={f} onClick={() => setNewsFilter(f)} style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${newsFilter === f ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`, background: newsFilter === f ? 'rgba(59,130,246,0.15)' : 'transparent', color: newsFilter === f ? '#3b82f6' : '#64748b', cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>
      {!filtered.length && <div style={{ ...card, color: '#64748b', textAlign: 'center', padding: 32 }}>No news. Set POLYGON_KEY env var to enable.</div>}
      {filtered.map((n, i) => (
        <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', ...card, padding: '14px 16px', borderLeft: `3px solid ${sentColor(n.sentiment)}`, border: `1px solid ${sentColor(n.sentiment)}25` }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 6, lineHeight: 1.5 }}>{n.headline}</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#475569' }}>{n.source}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>· {timeAgo(n.publishedAt)}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: sentColor(n.sentiment), background: sentColor(n.sentiment) + '20', borderRadius: 6, padding: '2px 8px' }}>{n.sentiment}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

function CongressTab({ d, ticker }) {
  const trades = d.congressTrades || [];
  return (
    <div style={card}>
      {!trades.length ? <div style={{ color: '#64748b', textAlign: 'center', padding: 32 }}>No congress trades for {ticker?.toUpperCase()}.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Member', 'Party', 'Transaction', 'Amount', 'Date', 'Disclosed'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 500 }}>{t.member_name}</td>
                  <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 11, fontWeight: 700, color: t.party === 'R' ? '#ef4444' : '#3b82f6', background: t.party === 'R' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', borderRadius: 4, padding: '2px 6px' }}>{t.party}</span></td>
                  <td style={{ padding: '10px 12px', color: (t.transaction_type || '').toLowerCase().includes('purchase') ? '#10b981' : '#ef4444', fontWeight: 600 }}>{t.transaction_type}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{t.amount_range}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: 12 }}>{t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: 12 }}>{t.disclosure_date ? new Date(t.disclosure_date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InsiderTab({ d, ticker }) {
  const trades = d.insiderTrades || [];
  return (
    <div style={card}>
      {!trades.length ? <div style={{ color: '#64748b', textAlign: 'center', padding: 32 }}>No insider trades for {ticker?.toUpperCase()}.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Insider', 'Title', 'Transaction', 'Shares', 'Value', 'Date'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 500 }}>{t.insider_name}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>{t.title}</td>
                  <td style={{ padding: '10px 12px', color: (t.trade_type || '').toLowerCase().includes('buy') || (t.trade_type || '').toLowerCase().includes('acqui') ? '#10b981' : '#ef4444', fontWeight: 600 }}>{t.trade_type}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{t.qty ? Number(t.qty).toLocaleString() : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{fmtBig(t.value)}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: 12 }}>{t.trade_date ? new Date(t.trade_date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AiTab({ d }) {
  const ai = d.aiVerdict;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!ai ? (
        <div style={{ ...card, color: '#64748b', textAlign: 'center', padding: 40 }}>
          No AI analysis. Set GEMINI_API_KEY env var to enable.
        </div>
      ) : (
        <>
          <div style={{ ...card, border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Brain size={16} color="#8b5cf6" />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Gemini AI Analysis</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ padding: '10px 20px', borderRadius: 12, background: sigColor(ai.signal) + '20', border: `1px solid ${sigColor(ai.signal)}50` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: sigColor(ai.signal) }}>{(ai.signal || '').toUpperCase()}</div>
              </div>
              {ai.confidence && <MetricCard label="Confidence" value={`${ai.confidence}%`} />}
              {ai.beatProbability && <MetricCard label="Beat Probability" value={`${ai.beatProbability}%`} color="#3b82f6" />}
              {ai.sentiment && <MetricCard label="Sentiment" value={ai.sentiment} color={sentColor(ai.sentiment)} />}
            </div>
            {ai.summary && <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 16, fontSize: 14, color: '#94a3b8', lineHeight: 1.8 }}>{ai.summary}</div>}
            {ai.technicalView && <div style={{ marginTop: 14 }}><div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Technical View</div><p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>{ai.technicalView}</p></div>}
          </div>
          {(ai.keyFactors?.length || ai.risks?.length) ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {ai.keyFactors?.length > 0 && (
                <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>Bull Case</div>
                  {ai.keyFactors.map((f, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, color: '#94a3b8' }}><span style={{ color: '#10b981' }}>✓</span>{f}</div>)}
                </div>
              )}
              {ai.risks?.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>Bear Case</div>
                  {ai.risks.map((r, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, color: '#94a3b8' }}><span style={{ color: '#ef4444' }}>✗</span>{r}</div>)}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
      {(d.secFilings || []).length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={15} color="#94a3b8" /> Recent SEC Filings
          </div>
          {d.secFilings.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>{f.formType}</span>
              <span style={{ fontSize: 13, color: '#94a3b8', flex: 1 }}>{f.entityName || d.ticker}</span>
              <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'JetBrains Mono', flexShrink: 0 }}>{f.filedDate}</span>
              <a href={f.url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', flexShrink: 0 }}><ExternalLink size={13} /></a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
