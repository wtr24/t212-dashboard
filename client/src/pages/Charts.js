import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '../hooks/useApi';

const COLORS = ['#00ff88','#00cc66','#0099ff','#7c3aed','#ffb800','#ff3257','#00ffff','#ff6600','#cc00ff','#00ff44'];

const CardWrap = ({ title, children, delay = 0 }) => (
  <motion.div className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
    style={{ padding: 24, marginBottom: 24 }}>
    <div style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20 }}>{title}</div>
    {children}
  </motion.div>
);

const tip = { contentStyle: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#8b949e' }, itemStyle: { color: '#e6edf3' } };

export default function Charts() {
  const { data: allocation } = useApi('/portfolio/allocation');
  const { data: summary } = useApi('/portfolio/summary');
  const { data: dividends } = useApi('/portfolio/dividends');

  const byStock = allocation?.byStock || [];
  const pnlData = byStock.map(s => ({ name: s.ticker, value: parseFloat(s.value?.toFixed(2)) || 0, pct: parseFloat(s.pct?.toFixed(1)) || 0 }));

  const divData = (dividends?.dividends || []).reduce((acc, d) => {
    const month = d.paidDate ? new Date(d.paidDate).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : 'N/A';
    const ex = acc.find(a => a.month === month);
    if (ex) ex.amount += d.amount || 0;
    else acc.push({ month, amount: parseFloat((d.amount || 0).toFixed(2)) });
    return acc;
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Charts & Analytics</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <CardWrap title="Portfolio Allocation" delay={0.1}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pnlData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={2}>
                {pnlData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />)}
              </Pie>
              <Tooltip {...tip} formatter={(v) => [`£${v.toFixed(2)}`, 'Value']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {pnlData.slice(0, 6).map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                <span style={{ color: 'var(--muted)' }}>{d.name}</span>
                <span className="mono">{d.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </CardWrap>

        <CardWrap title="Position Values" delay={0.15}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pnlData} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8b949e' }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} tickFormatter={v => `£${v}`} />
              <Tooltip {...tip} formatter={(v) => [`£${v.toFixed(2)}`, 'Value']} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {pnlData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardWrap>
      </div>

      {divData.length > 0 && (
        <CardWrap title="Dividend Income by Month" delay={0.2}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={divData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8b949e' }} />
              <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} tickFormatter={v => `£${v}`} />
              <Tooltip {...tip} formatter={(v) => [`£${v.toFixed(2)}`, 'Dividends']} />
              <Bar dataKey="amount" fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </CardWrap>
      )}

      <CardWrap title="Holdings Weight" delay={0.25}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={pnlData} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: '#8b949e' }} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8b949e' }} width={50} />
            <Tooltip {...tip} formatter={(v) => [`${v.toFixed(1)}%`, 'Weight']} />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
              {pnlData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardWrap>
    </div>
  );
}
