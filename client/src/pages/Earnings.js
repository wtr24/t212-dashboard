import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, RefreshCw, Clock, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { StockLogo } from '../utils/stockLogo';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5002';

function fmt2(n) { return (n == null || isNaN(n)) ? '—' : (n >= 0 ? '+' : '') + Number(n).toFixed(2); }
function fmtEps(n) { return n == null ? '—' : (n >= 0 ? '+' : '') + '$' + Math.abs(n).toFixed(2); }

function SurprisePill({ surprise, surprisePct }) {
  if (surprise == null) return null;
  const beat = surprise > 0;
  const inline = Math.abs(surprise) < 0.005;
  const color = inline ? 'var(--text-3)' : beat ? 'var(--gain)' : 'var(--loss)';
  const bg = inline ? 'var(--surface-2)' : beat ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, padding: '2px 8px', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace' }}>
      {inline ? 'Inline' : (beat ? '↑ Beat' : '↓ Miss')} {surprisePct != null ? `${Math.abs(surprisePct).toFixed(1)}%` : ''}
    </span>
  );
}

function TimeBadge({ time }) {
  const label = time === 'BMO' ? 'Pre-Mkt' : time === 'AMC' ? 'After-Hrs' : 'TBD';
  const color = time === 'BMO' ? '#f59e0b' : time === 'AMC' ? '#8b5cf6' : 'var(--text-3)';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: '2px 7px', borderRadius: 5, letterSpacing: 0.5 }}>
      {label}
    </span>
  );
}

function EarningsCard({ e, expanded, onToggle }) {
  const reported = e.status === 'reported';
  const beat = reported && e.eps_surprise > 0.005;
  const miss = reported && e.eps_surprise < -0.005;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ background: 'var(--surface)', border: `1px solid ${beat ? 'rgba(16,185,129,0.25)' : miss ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`, borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'border-color 0.2s' }}
      onClick={onToggle}
      whileHover={{ y: -1 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StockLogo ticker={e.ticker} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{e.ticker}</span>
            <TimeBadge time={e.report_time} />
            {reported && <SurprisePill surprise={e.eps_surprise} surprisePct={e.eps_surprise_pct} />}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.company || e.ticker}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>EPS Est</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtEps(e.eps_estimate)}</div>
        </div>
        {expanded ? <ChevronUp size={14} color="var(--text-3)" /> : <ChevronDown size={14} color="var(--text-3)" />}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px 16px' }}>
              {[
                { label: 'EPS Estimate', value: fmtEps(e.eps_estimate) },
                { label: 'EPS Actual', value: reported ? fmtEps(e.eps_actual) : '—' },
                { label: 'Surprise', value: reported ? fmt2(e.eps_surprise) : '—' },
                { label: 'Quarter', value: e.fiscal_quarter || '—' },
                { label: 'Rev Estimate', value: e.revenue_estimate ? `$${(e.revenue_estimate/1e9).toFixed(1)}B` : '—' },
                { label: 'Rev Actual', value: e.revenue_actual ? `$${(e.revenue_actual/1e9).toFixed(1)}B` : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TodayView({ data, expanded, setExpanded }) {
  const bmo = data.filter(e => e.report_time === 'BMO');
  const amc = data.filter(e => e.report_time === 'AMC');
  const other = data.filter(e => !['BMO','AMC'].includes(e.report_time));

  if (!data.length) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
      <Calendar size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div style={{ fontSize: 15, fontWeight: 600 }}>No earnings today</div>
    </div>
  );

  const Section = ({ title, items }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{title} — {items.length}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(e => <EarningsCard key={e.id} e={e} expanded={expanded === e.id} onToggle={() => setExpanded(expanded === e.id ? null : e.id)} />)}
      </div>
    </div>
  );

  return (
    <>
      <Section title="Before Market Open" items={bmo} />
      <Section title="After Market Close" items={amc} />
      <Section title="Time TBD" items={other} />
    </>
  );
}

function WeekView({ data, expanded, setExpanded }) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const today = new Date().toISOString().split('T')[0];

  if (!Object.keys(data).length) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
      <Calendar size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div style={{ fontSize: 15, fontWeight: 600 }}>No earnings this week</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>Check back during earnings season (Jan/Apr/Jul/Oct)</div>
    </div>
  );

  const sortedDates = Object.keys(data).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {sortedDates.map(date => {
        const d = new Date(date + 'T12:00:00');
        const dayName = days[d.getDay() - 1] || d.toLocaleDateString('en-GB', { weekday: 'long' });
        const isToday = date === today;
        const items = data[date] || [];

        return (
          <div key={date}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? '#3b82f6' : 'var(--text)', background: isToday ? 'rgba(59,130,246,0.12)' : 'transparent', padding: isToday ? '4px 12px' : 0, borderRadius: 8 }}>
                {dayName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 10 }}>{items.length} earnings</div>
              {isToday && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px rgba(59,130,246,0.6)' }} />}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
              {items.map(e => <EarningsCard key={e.id} e={e} expanded={expanded === e.id} onToggle={() => setExpanded(expanded === e.id ? null : e.id)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryView({ data }) {
  if (!data.length) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>No historical earnings yet</div>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            {['Date','Company','Quarter','EPS Est','EPS Actual','Surprise','Rev Est','Status'].map(h => (
              <th key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.7, padding: '10px 12px', background: 'var(--surface-2)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((e, i) => {
            const beat = e.eps_surprise > 0.005;
            const miss = e.eps_surprise < -0.005;
            return (
              <tr key={e.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{String(e.report_date).split('T')[0]}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StockLogo ticker={e.ticker} size="sm" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{e.ticker}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.company}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>{e.fiscal_quarter || '—'}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{fmtEps(e.eps_estimate)}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, borderBottom: '1px solid var(--border)', color: beat ? 'var(--gain)' : miss ? 'var(--loss)' : 'var(--text)' }}>{e.eps_actual != null ? fmtEps(e.eps_actual) : '—'}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}><SurprisePill surprise={e.eps_surprise} surprisePct={e.eps_surprise_pct} /></td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>{e.revenue_estimate ? `$${(e.revenue_estimate/1e9).toFixed(1)}B` : '—'}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: e.status === 'reported' ? 'var(--gain)' : 'var(--text-3)', background: e.status === 'reported' ? 'rgba(16,185,129,0.1)' : 'var(--surface-2)', padding: '2px 8px', borderRadius: 5 }}>
                    {e.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Earnings() {
  const [tab, setTab] = useState('week');
  const [data, setData] = useState({ today: [], week: {}, month: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const fetchData = useCallback(async (view) => {
    setLoading(true);
    try {
      const [res, statusRes] = await Promise.all([
        fetch(`${API}/api/earnings/${view === 'history' ? 'history' : view === 'month' ? 'month' : view === 'today' ? 'today' : 'week'}`),
        fetch(`${API}/api/earnings/scrape-status`),
      ]);
      const json = await res.json();
      const status = await statusRes.json().catch(() => null);
      setScrapeStatus(status);
      setData(prev => ({ ...prev, [view]: json }));
    } catch (e) {
      console.error('[earnings]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(tab); }, [tab, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API}/api/earnings/refresh`, { method: 'POST' });
      setTimeout(() => { fetchData(tab); setRefreshing(false); }, 3000);
    } catch { setRefreshing(false); }
  };

  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'history', label: 'History' },
  ];

  const todayCount = Array.isArray(data.today) ? data.today.length : 0;
  const weekCount = Object.values(data.week || {}).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Calendar size={20} color="#3b82f6" />
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Earnings Calendar</h2>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {scrapeStatus ? `${scrapeStatus.total} earnings tracked · ${String(scrapeStatus.earliest || '').split('T')[0]} to ${String(scrapeStatus.latest || '').split('T')[0]}` : 'Loading status...'}
          </div>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', fontSize: 13, fontWeight: 500, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1 }}>
          {refreshing ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
          {refreshing ? 'Scraping...' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '7px 18px', borderRadius: 9, border: 'none', background: tab === t.id ? 'rgba(59,130,246,0.15)' : 'transparent', color: tab === t.id ? '#3b82f6' : 'var(--text-3)', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {t.label}
            {t.id === 'today' && todayCount > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: '#3b82f6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>{todayCount}</span>}
            {t.id === 'week' && weekCount > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(59,130,246,0.3)', color: '#3b82f6', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>{weekCount}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', padding: 40 }}>
          <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
          Loading earnings data...
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {tab === 'today' && <TodayView data={data.today || []} expanded={expanded} setExpanded={setExpanded} />}
            {tab === 'week' && <WeekView data={data.week || {}} expanded={expanded} setExpanded={setExpanded} />}
            {tab === 'month' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                {(data.month || []).map(e => <EarningsCard key={e.id} e={e} expanded={expanded === e.id} onToggle={() => setExpanded(expanded === e.id ? null : e.id)} />)}
                {!(data.month || []).length && <div style={{ color: 'var(--text-3)', padding: 40, gridColumn: '1/-1', textAlign: 'center' }}>No earnings this month</div>}
              </div>
            )}
            {tab === 'history' && <HistoryView data={data.history || []} />}
          </motion.div>
        </AnimatePresence>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
