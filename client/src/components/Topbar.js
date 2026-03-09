import { useState, useEffect } from 'react';

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{time.toLocaleTimeString('en-GB')}</span>;
}

function MarketPill({ label, open }) {
  const now = new Date();
  const h = now.getUTCHours();
  const isOpen = open ? h >= 14 && h < 21 : h >= 8 && h < 16;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px', borderRadius: 20, background: isOpen ? 'rgba(0,255,136,0.1)' : 'rgba(139,148,158,0.1)', border: `1px solid ${isOpen ? 'rgba(0,255,136,0.3)' : 'rgba(139,148,158,0.2)'}`, color: isOpen ? 'var(--accent)' : 'var(--muted)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOpen ? 'var(--accent)' : 'var(--muted)', boxShadow: isOpen ? '0 0 6px var(--accent)' : 'none' }} />
      {label} {isOpen ? 'OPEN' : 'CLOSED'}
    </div>
  );
}

export default function Topbar() {
  return (
    <div style={{ height: 52, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>Trading 212 Portfolio Analytics</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <MarketPill label="NYSE" open={true} />
        <MarketPill label="LSE" open={false} />
        <Clock />
      </div>
    </div>
  );
}
