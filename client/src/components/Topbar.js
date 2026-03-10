import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-3)', letterSpacing: 0.5 }}>{time.toLocaleTimeString('en-GB')}</span>;
}

function MarketPill({ label, open }) {
  const h = new Date().getUTCHours();
  const isOpen = open ? h >= 14 && h < 21 : h >= 8 && h < 16;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: isOpen ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', color: isOpen ? '#10b981' : 'var(--text-3)', border: `1px solid ${isOpen ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.07)'}`, backdropFilter: 'blur(8px)' }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: isOpen ? '#10b981' : 'var(--text-3)', animation: isOpen ? 'pulse 2s infinite' : 'none' }} />
      {label}
    </div>
  );
}

export default function Topbar() {
  const location = useLocation();
  const PAGE_NAMES = {
    '/dashboard': 'Dashboard',
    '/positions': 'Positions',
    '/charts': 'Charts',
    '/predictions': 'AI Signals',
    '/congress': 'Congress Tracker',
    '/insider': 'Insider Trading',
    '/history': 'Order History',
    '/dividends': 'Dividends',
    '/settings': 'Settings',
  };
  const pageName = PAGE_NAMES[location.pathname] || PAGE_NAMES[`/${location.pathname.split('/')[1]}`] || 'Dashboard';
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await axios.post(`${BASE}/refresh/all`).catch(() => {});
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <div style={{ height: 56, background: 'rgba(8,13,26,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{pageName}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <MarketPill label="NYSE" open={true} />
        <MarketPill label="LSE" open={false} />
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.07)', margin: '0 2px' }} />
        <Clock />
        <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '6px 14px', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, transition: 'all 0.15s', fontFamily: 'Outfit, sans-serif' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; e.currentTarget.style.color = '#3b82f6'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'var(--text-2)'; }}>
          <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );
}
