import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{time.toLocaleTimeString('en-GB')}</span>;
}

function MarketPill({ label, open }) {
  const h = new Date().getUTCHours();
  const isOpen = open ? h >= 14 && h < 21 : h >= 8 && h < 16;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: isOpen ? 'var(--gain-dim)' : 'rgba(255,255,255,0.04)', color: isOpen ? 'var(--gain)' : 'var(--text-3)', border: `1px solid ${isOpen ? 'rgba(34,197,94,0.2)' : 'var(--border)'}` }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: isOpen ? 'var(--gain)' : 'var(--text-3)', animation: isOpen ? 'pulse 2s infinite' : 'none' }} />
      {label}
    </div>
  );
}

export default function Topbar() {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await axios.post(`${BASE}/refresh/all`).catch(() => {});
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <div style={{ height: 56, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>Portfolio Analytics</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <MarketPill label="NYSE" open={true} />
        <MarketPill label="LSE" open={false} />
        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
        <Clock />
        <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, transition: 'all 0.15s' }}>
          <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );
}
