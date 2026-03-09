import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '../hooks/useApi';
import CountUp from '../components/CountUp';
import { Coins } from 'lucide-react';

const tip = {
  contentStyle: { background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
  labelStyle: { color: '#6b7280', fontWeight: 600 },
};

export default function Dividends() {
  const { data, loading } = useApi('/portfolio/dividends');
  const { dividends = [], totalReceived = 0 } = data || {};

  const monthly = dividends.reduce((acc, d) => {
    const month = d.paidDate ? new Date(d.paidDate).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : 'N/A';
    const ex = acc.find(a => a.month === month);
    if (ex) ex.amount += d.amount || 0;
    else acc.push({ month, amount: parseFloat((d.amount || 0).toFixed(2)) });
    return acc;
  }, []);

  const annualised = totalReceived > 0 ? totalReceived * (12 / Math.max(monthly.length, 1)) : 0;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Dividend Income</h2>
      <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Received', value: totalReceived, color: 'var(--gain)', delay: 0 },
          { label: 'Projected Annual', value: annualised, color: 'var(--warning)', delay: 0.1 },
          { label: 'Total Payments', value: dividends.length, color: 'var(--text)', delay: 0.2, noPrefix: true },
        ].map(({ label, value, color, delay, noPrefix }) => (
          <motion.div key={label} className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} style={{ padding: '22px 28px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>{label}</div>
            <div className="mono" style={{ fontSize: 30, fontWeight: 500, color, letterSpacing: '-1px' }}>
              {noPrefix ? value : <>£<CountUp value={value} duration={1200} /></>}
            </div>
          </motion.div>
        ))}
      </div>

      {monthly.length > 0 && (
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 20 }}>Monthly Income</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `£${v}`} axisLine={false} tickLine={false} />
              <Tooltip {...tip} formatter={(v) => [`£${v.toFixed(2)}`, 'Dividends']} />
              <Bar dataKey="amount" fill="var(--accent)" radius={[6, 6, 0, 0]} opacity={0.85} isAnimationActive={true} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)' }}>Payment History</div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div>
        ) : dividends.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: 'var(--text-3)' }}>
            <Coins size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No dividends yet</div>
            <div style={{ fontSize: 12 }}>Connect your T212 API key to see dividend history.</div>
          </div>
        ) : (
          dividends.map((d, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontWeight: 600, minWidth: 70, fontFamily: 'DM Mono, monospace' }}>{d.ticker || d.reference || '—'}</span>
              <span className="mono" style={{ color: 'var(--gain)', fontWeight: 500 }}>+£{(d.amount || d.grossAmount || 0).toFixed(4)}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 'auto', fontSize: 12 }}>{d.paidDate ? new Date(d.paidDate).toLocaleDateString('en-GB') : '—'}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
