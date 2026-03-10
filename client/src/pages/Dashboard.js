import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Activity, Wallet, PiggyBank } from 'lucide-react';
import { usePortfolio } from '../hooks/useApi';
import CountUp from '../components/CountUp';
import FearGreedGauge from '../components/FearGreedGauge';
import TickerBanner from '../components/TickerBanner';
import OutlookBadge from '../components/OutlookBadge';
import { SkeletonMetric, Skeleton } from '../components/Skeleton';
import DataBanner from '../components/DataBanner';

function StatCard({ label, value, prefix = '£', suffix = '', change, icon: Icon, delay = 0, loading, iconColor }) {
  const num = parseFloat(value) || 0;
  const isPos = change !== undefined ? change >= 0 : num >= 0;
  const tint = iconColor || (isPos ? '#10b981' : '#ef4444');
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}
      style={{ padding: '20px 22px', flex: 1, minWidth: 160, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, backdropFilter: 'blur(12px)', transition: 'border-color 0.18s, box-shadow 0.18s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; }}>
      {loading ? <SkeletonMetric /> : <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
          {Icon && <div style={{ padding: 8, borderRadius: 10, background: `${tint}1a` }}><Icon size={14} color={tint} /></div>}
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 500, color: '#f1f5f9', marginBottom: 6, letterSpacing: '-0.5px' }}>
          {prefix}<CountUp value={Math.abs(num)} decimals={2} />{suffix}
        </div>
        {change !== undefined && (
          <div style={{ fontSize: 12, color: isPos ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
            {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isPos ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
      </>}
    </motion.div>
  );
}

function MiniCard({ label, ticker, val, isPos, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ padding: '16px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, backdropFilter: 'blur(12px)' }}>
      <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'JetBrains Mono', color: '#3b82f6' }}>{ticker || '—'}</div>
      {val !== undefined && val !== null && (
        <div style={{ fontSize: 12, color: isPos ? '#10b981' : '#ef4444', marginTop: 4, fontWeight: 500 }}>
          {val >= 0 ? '+' : ''}£{Math.abs(val).toFixed(2)}
        </div>
      )}
    </motion.div>
  );
}

export default function Dashboard() {
  const { summary, positions, fearGreed } = usePortfolio();
  const s = summary.data || {};
  const sum = s.summary || {};
  const pos = (positions.data?.positions || positions.data || []);
  const fg = fearGreed.data || {};
  const sorted = [...pos].sort((a, b) => (b.ppl || 0) - (a.ppl || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const biggestByValue = [...pos].sort((a, b) => (b.currentPrice * b.quantity || 0) - (a.currentPrice * a.quantity || 0))[0];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <DataBanner source={summary.data?.meta?.portfolioSource} age={summary.data?.meta?.portfolioAge} onRefresh={() => { summary.refetch(); positions.refetch(); }} />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ marginBottom: 32, padding: '28px 32px', background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.06) 100%)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total Portfolio Value</div>
        {summary.loading
          ? <Skeleton width={280} height={52} style={{ marginBottom: 8 }} />
          : <div style={{ fontFamily: 'JetBrains Mono', fontSize: 52, fontWeight: 700, color: '#f1f5f9', lineHeight: 1, marginBottom: 10, letterSpacing: '-2px' }}>
              £<CountUp value={sum.totalValue || s.totalValue || 0} decimals={2} duration={1400} />
            </div>
        }
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {!summary.loading && (
            <>
              <span style={{ fontSize: 13, color: (s.unrealizedPnl || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {(s.unrealizedPnl || 0) >= 0 ? '+' : ''}£{Math.abs(s.unrealizedPnl || 0).toFixed(2)} unrealised
              </span>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 16 }}>·</span>
              <span style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>+£{(s.realizedPnl || 0).toFixed(2)} realised</span>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 16 }}>·</span>
              <span style={{ fontSize: 13, color: '#475569', padding: '2px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>S&amp;S ISA · GBP</span>
            </>
          )}
        </div>
      </motion.div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {summary.loading
          ? [0,1,2,3,4].map(i => <SkeletonMetric key={i} />)
          : <>
            <StatCard label="Total Return" value={s.totalPnl} change={s.returnPct} icon={TrendingUp} delay={0.05} />
            <StatCard label="Daily P&L" value={s.cash?.result} icon={Activity} delay={0.1} iconColor="#8b5cf6" />
            <StatCard label="Free Cash" value={s.cash?.free} icon={Wallet} delay={0.15} iconColor="#3b82f6" />
            <StatCard label="Invested" value={s.cash?.invested} icon={PiggyBank} delay={0.2} iconColor="#8b5cf6" />
            <StatCard label="Return %" value={s.returnPct} prefix="" suffix="%" icon={DollarSign} delay={0.25} />
          </>
        }
      </div>

      <TickerBanner positions={pos} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <MiniCard label="Best Position" ticker={best?.ticker} val={best?.ppl} isPos={true} delay={0.1} />
          <MiniCard label="Worst Position" ticker={worst?.ticker} val={worst?.ppl} isPos={false} delay={0.15} />
          <MiniCard label="Holdings" ticker={`${pos.length} stocks`} delay={0.2} />
          <MiniCard label="Biggest Position" ticker={biggestByValue?.ticker} delay={0.25} />
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FearGreedGauge score={fg.score} rating={fg.rating} />
        </motion.div>
      </div>

      {pos.filter(p => p.analysis).length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14, marginTop: 8 }}>AI Signals</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {pos.filter(p => p.analysis).slice(0, 6).map((p, i) => (
              <motion.div key={p.ticker} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#3b82f6' }}>{p.ticker}</div>
                  <OutlookBadge outlook={p.analysis?.outlook} confidence={p.analysis?.confidence} risk={p.analysis?.risk_level} />
                </div>
                {p.analysis?.reason && <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{p.analysis.reason}</div>}
                {p.analysis?.confidence !== undefined && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${p.analysis.confidence}%` }} transition={{ delay: i * 0.05 + 0.4, duration: 0.6 }}
                        style={{ height: '100%', background: p.analysis.outlook === 'BULLISH' ? '#10b981' : p.analysis.outlook === 'BEARISH' ? '#ef4444' : '#f59e0b', borderRadius: 2 }} />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
