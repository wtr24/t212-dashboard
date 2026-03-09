import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { usePortfolio } from '../hooks/useApi';
import CountUp from '../components/CountUp';
import FearGreedGauge from '../components/FearGreedGauge';
import TickerBanner from '../components/TickerBanner';
import OutlookBadge from '../components/OutlookBadge';
import { SkeletonMetric, Skeleton } from '../components/Skeleton';
import DataBanner from '../components/DataBanner';

function StatCard({ label, value, prefix = '£', suffix = '', change, icon: Icon, delay = 0, loading }) {
  const num = parseFloat(value) || 0;
  const isPos = change !== undefined ? change >= 0 : num >= 0;
  return (
    <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}
      style={{ padding: '22px 24px', flex: 1, minWidth: 160 }}>
      {loading ? <SkeletonMetric /> : <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <span className="label">{label}</span>
          {Icon && <div style={{ padding: 8, borderRadius: 8, background: isPos ? 'var(--gain-dim)' : 'var(--loss-dim)' }}>
            <Icon size={14} color={isPos ? 'var(--gain)' : 'var(--loss)'} />
          </div>}
        </div>
        <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {prefix}<CountUp value={Math.abs(num)} decimals={2} />{suffix}
        </div>
        {change !== undefined && (
          <div style={{ fontSize: 12, color: isPos ? 'var(--gain)' : 'var(--loss)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isPos ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
      </>}
    </motion.div>
  );
}

function SectionLabel({ children }) {
  return <div className="label" style={{ marginBottom: 14, marginTop: 8 }}>{children}</div>;
}

export default function Dashboard() {
  const { summary, positions, fearGreed } = usePortfolio();
  const s = summary.data || {};
  const pos = (positions.data?.positions || positions.data || []);
  const fg = fearGreed.data || {};
  const sorted = [...pos].sort((a, b) => (b.ppl || 0) - (a.ppl || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <DataBanner source={summary.data?.meta?.portfolioSource} age={summary.data?.meta?.portfolioAge} onRefresh={() => { summary.refetch(); positions.refetch(); }} />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ marginBottom: 32 }}>
        <div className="label" style={{ marginBottom: 10 }}>Total Portfolio Value</div>
        {summary.loading
          ? <Skeleton width={280} height={52} style={{ marginBottom: 8 }} />
          : <div className="mono" style={{ fontSize: 52, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 8 }}>
              £<CountUp value={s.totalValue || 0} decimals={2} duration={1400} />
            </div>
        }
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!summary.loading && s.totalPnl !== undefined && (
            <>
              <span style={{ fontSize: 13, color: (s.totalPnl || 0) >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 600 }}>
                {(s.totalPnl || 0) >= 0 ? '+' : ''}£{Math.abs(s.totalPnl || 0).toFixed(2)} all time
              </span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>ISA Account · GBP</span>
            </>
          )}
        </div>
      </motion.div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {summary.loading
          ? [0,1,2,3,4].map(i => <SkeletonMetric key={i} />)
          : <>
            <StatCard label="Total Return" value={s.totalPnl} change={s.returnPct} icon={TrendingUp} delay={0.05} />
            <StatCard label="Daily P&L" value={s.cash?.result} icon={Activity} delay={0.1} />
            <StatCard label="Free Cash" value={s.cash?.free} icon={DollarSign} delay={0.15} />
            <StatCard label="Invested" value={s.cash?.invested} icon={DollarSign} delay={0.2} />
            <StatCard label="Return %" value={s.returnPct} prefix="" suffix="%" delay={0.25} />
          </>
        }
      </div>

      <TickerBanner positions={pos} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Best Position', ticker: best?.ticker, val: best?.ppl, pos: true },
            { label: 'Worst Position', ticker: worst?.ticker, val: worst?.ppl, pos: false },
            { label: 'Holdings', ticker: `${pos.length} stocks`, val: null },
            { label: 'Biggest Position', ticker: pos.sort?.((a,b)=>(b.currentPrice*b.quantity)-(a.currentPrice*a.quantity))[0]?.ticker, val: null },
          ].map(({ label, ticker, val, pos: isPos }, i) => (
            <motion.div key={label} className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
              style={{ padding: '18px 20px' }}>
              <div className="label" style={{ marginBottom: 10 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{ticker || '—'}</div>
              {val !== undefined && val !== null && (
                <div style={{ fontSize: 12, color: isPos ? 'var(--gain)' : 'var(--loss)', marginTop: 4 }}>
                  {val >= 0 ? '+' : ''}£{Math.abs(val).toFixed(2)}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FearGreedGauge score={fg.score} rating={fg.rating} />
        </motion.div>
      </div>

      {pos.filter(p => p.analysis).length > 0 && (
        <div>
          <SectionLabel>AI Signals</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {pos.filter(p => p.analysis).slice(0, 6).map((p, i) => (
              <motion.div key={p.ticker} className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700 }}>{p.ticker}</div>
                  <OutlookBadge outlook={p.analysis?.outlook} confidence={p.analysis?.confidence} risk={p.analysis?.risk_level} />
                </div>
                {p.analysis?.reason && <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{p.analysis.reason}</div>}
                {p.analysis?.confidence !== undefined && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${p.analysis.confidence}%` }} transition={{ delay: i * 0.05 + 0.4, duration: 0.6 }}
                        style={{ height: '100%', background: p.analysis.outlook === 'BULLISH' ? 'var(--gain)' : p.analysis.outlook === 'BEARISH' ? 'var(--loss)' : 'var(--warning)', borderRadius: 2 }} />
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
