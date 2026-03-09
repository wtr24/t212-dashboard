import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '../hooks/useApi';
import CountUp from '../components/CountUp';

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

  const tip = { contentStyle: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12 } };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Dividend Income</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <motion.div className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '20px 28px', flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Total Received</div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>£<CountUp value={totalReceived} duration={1200} /></div>
        </motion.div>
        <motion.div className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ padding: '20px 28px', flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Projected Annual</div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--warning)' }}>£<CountUp value={annualised} duration={1400} /></div>
        </motion.div>
        <motion.div className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ padding: '20px 28px', flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Payments</div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>{dividends.length}</div>
        </motion.div>
      </div>

      {monthly.length > 0 && (
        <motion.div className="glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20 }}>Monthly Income</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8b949e' }} />
              <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} tickFormatter={v => `£${v}`} />
              <Tooltip {...tip} formatter={(v) => [`£${v.toFixed(2)}`, 'Dividends']} />
              <Bar dataKey="amount" fill="var(--accent)" radius={[4,4,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      <div className="glass">
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Payment History</div>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div> : dividends.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No dividends found. Connect your T212 API key.</div>
        ) : (
          dividends.map((d, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontWeight: 600, minWidth: 60 }}>{d.ticker || d.reference || '—'}</span>
              <span className="mono" style={{ color: 'var(--accent)' }}>+£{(d.amount || d.grossAmount || 0).toFixed(4)}</span>
              <span style={{ color: 'var(--muted)', marginLeft: 'auto', fontSize: 12 }}>{d.paidDate ? new Date(d.paidDate).toLocaleDateString('en-GB') : '—'}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
