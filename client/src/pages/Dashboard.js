import { motion } from 'framer-motion';
import { usePortfolio } from '../hooks/useApi';
import CountUp from '../components/CountUp';
import FearGreedGauge from '../components/FearGreedGauge';
import TickerBanner from '../components/TickerBanner';
import OutlookBadge from '../components/OutlookBadge';

function BigValue({ value, loading }) {
  if (loading) return <div className="mono" style={{ fontSize: 56, fontWeight: 700, color: 'var(--accent)', opacity: 0.3 }}>£--,---.--</div>;
  return (
    <motion.div className="mono" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{ fontSize: 56, fontWeight: 700, color: 'var(--accent)', textShadow: '0 0 40px rgba(0,255,136,0.3)' }}>
      £<CountUp value={value} decimals={2} duration={1500} />
    </motion.div>
  );
}

function MetricRow({ label, value, prefix = '£', pct, loading }) {
  const num = parseFloat(value) || 0;
  const isPos = num >= 0;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: loading ? 'var(--muted)' : isPos ? 'var(--accent)' : 'var(--danger)' }}>
        {loading ? '--' : <>{prefix}<CountUp value={Math.abs(num)} decimals={2} /></>}
      </div>
      {pct !== undefined && !loading && <div style={{ fontSize: 11, color: isPos ? 'var(--accent)' : 'var(--danger)' }}>{isPos ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%</div>}
    </div>
  );
}

function QuickCard({ title, ticker, value, pct, delay }) {
  const isPos = (parseFloat(pct) || 0) >= 0;
  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ padding: 16, flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{title}</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{ticker || '—'}</div>
      {value && <div className="mono" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>£{(parseFloat(value) || 0).toFixed(2)}</div>}
      {pct !== undefined && <div style={{ fontSize: 12, color: isPos ? 'var(--accent)' : 'var(--danger)', marginTop: 2 }}>{isPos ? '+' : ''}{(parseFloat(pct) || 0).toFixed(2)}%</div>}
    </motion.div>
  );
}

export default function Dashboard() {
  const { summary, positions, fearGreed } = usePortfolio();
  const s = summary.data || {};
  const pos = positions.data || [];
  const fg = fearGreed.data || {};

  const sorted = [...pos].sort((a, b) => (b.ppl || 0) - (a.ppl || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const biggest = [...pos].sort((a, b) => (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity))[0];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 12 }}>Total Portfolio Value</div>
        <BigValue value={s.totalValue} loading={summary.loading} />
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>ISA Account · GBP</div>
      </div>

      <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
        <MetricRow label="Total P&L" value={s.totalPnl} pct={s.returnPct} loading={summary.loading} />
        <MetricRow label="Daily P&L" value={s.cash?.result} loading={summary.loading} />
        <MetricRow label="Free Cash" value={s.cash?.free} loading={summary.loading} />
        <MetricRow label="Invested" value={s.cash?.invested} loading={summary.loading} />
        <MetricRow label="Return" value={s.returnPct} prefix="" suffix="%" loading={summary.loading} />
      </div>

      <TickerBanner positions={pos} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <QuickCard title="Best Position" ticker={best?.ticker} value={best?.ppl} pct={best ? ((best.ppl || 0) / (best.averagePrice * best.quantity) * 100) : 0} delay={0.1} />
          <QuickCard title="Worst Position" ticker={worst?.ticker} value={worst?.ppl} pct={worst ? ((worst.ppl || 0) / (worst.averagePrice * worst.quantity) * 100) : 0} delay={0.15} />
          <QuickCard title="Biggest Holding" ticker={biggest?.ticker} value={biggest ? biggest.currentPrice * biggest.quantity : 0} delay={0.2} />
          <QuickCard title="Positions" ticker={`${pos.length} stocks`} delay={0.25} />
        </div>
        <motion.div className="glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <FearGreedGauge score={fg.score} rating={fg.rating} />
        </motion.div>
      </div>

      {pos.length > 0 && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>AI Analysis · Top Positions</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {pos.filter(p => p.analysis).slice(0, 6).map((p, i) => (
              <motion.div key={p.ticker} className="glass" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                style={{ padding: '12px 16px', minWidth: 180, flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{p.ticker}</div>
                <OutlookBadge outlook={p.analysis?.outlook} confidence={p.analysis?.confidence} risk={p.analysis?.risk_level} />
                {p.analysis?.reason && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>{p.analysis.reason}</div>}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
