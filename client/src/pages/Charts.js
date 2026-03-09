import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '../hooks/useApi';

const COLORS = ['#0d9488','#6366f1','#f59e0b','#f43f5e','#10b981','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316'];

const tip = {
  contentStyle: { background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'DM Sans, sans-serif' },
  labelStyle: { color: '#6b7280', fontWeight: 600 },
  itemStyle: { color: '#111827' },
};

const CardWrap = ({ title, children, delay = 0 }) => (
  <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
    style={{ padding: 24, marginBottom: 24 }}>
    <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 20 }}>{title}</div>
    {children}
  </motion.div>
);

export default function Charts() {
  const { data: allocation } = useApi('/portfolio/allocation');
  const { data: summary } = useApi('/portfolio/summary');
  const { data: dividends } = useApi('/portfolio/dividends');

  const byStock = allocation?.byStock || [];
  const pnlData = byStock.map(s => ({ name: s.ticker, value: parseFloat((s.value || 0).toFixed(2)), pct: parseFloat((s.pct || 0).toFixed(1)) }));

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 0 }}>
        <CardWrap title="Portfolio Allocation" delay={0.1}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pnlData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={2} animationBegin={0} animationDuration={800}>
                {pnlData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.9} />)}
              </Pie>
              <Tooltip {...tip} formatter={(v) => [`£${v.toFixed(2)}`, 'Value']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {pnlData.slice(0, 8).map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                <span style={{ color: 'var(--text-2)' }}>{d.name}</span>
                <span className="mono" style={{ color: 'var(--text)', fontWeight: 500 }}>{d.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </CardWrap>

        <CardWrap title="Position Values" delay={0.15}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pnlData} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'DM Mono' }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `£${v}`} axisLine={false} tickLine={false} />
              <Tooltip {...tip} formatter={(v) => [`£${v.toFixed(2)}`, 'Value']} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={800}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `£${v}`} axisLine={false} tickLine={false} />
              <Tooltip {...tip} formatter={(v) => [`£${v.toFixed(2)}`, 'Dividends']} />
              <Bar dataKey="amount" fill="var(--accent)" radius={[6, 6, 0, 0]} opacity={0.85} isAnimationActive={true} />
            </BarChart>
          </ResponsiveContainer>
        </CardWrap>
      )}

      <CardWrap title="Holdings Weight" delay={0.25}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={pnlData} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'DM Mono' }} width={60} axisLine={false} tickLine={false} />
            <Tooltip {...tip} formatter={(v) => [`${v.toFixed(1)}%`, 'Weight']} />
            <Bar dataKey="pct" radius={[0, 6, 6, 0]} isAnimationActive={true}>
              {pnlData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardWrap>
    </div>
  );
}
