import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

/* ── Clock ── */
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
      color: '#3d5070',
      letterSpacing: '0.04em',
      tabularNums: true,
    }}>
      {time.toLocaleTimeString('en-GB')}
    </span>
  );
}

/* ── Market status pill ── */
function MarketPill({ label, nyse }) {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const totalMins = h * 60 + m;

  const isOpen = nyse
    ? totalMins >= 870 && totalMins < 1260   /* 14:30–21:00 UTC */
    : totalMins >= 480 && totalMins < 990;   /* 08:00–16:30 UTC */

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 11px',
      borderRadius: 20,
      background: isOpen ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${isOpen ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.07)'}`,
      cursor: 'default',
    }}>
      <div style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: isOpen ? '#22c55e' : '#3d5070',
        animation: isOpen ? 'pulse 2s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 600,
        color: isOpen ? '#22c55e' : '#3d5070',
        letterSpacing: '0.08em',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: isOpen ? 'rgba(34,197,94,0.7)' : '#1e3050',
        fontFamily: "'Inter', sans-serif",
      }}>
        {isOpen ? 'OPEN' : 'CLOSED'}
      </span>
    </div>
  );
}

/* ── Divider ── */
function Divider() {
  return (
    <div style={{
      width: 1,
      height: 18,
      background: 'rgba(255,255,255,0.07)',
      flexShrink: 0,
      margin: '0 4px',
    }} />
  );
}

/* ── Page name map ── */
const PAGE_NAMES = {
  '/dashboard':  ['Portfolio', 'Dashboard'],
  '/positions':  ['Portfolio', 'Positions'],
  '/history':    ['Portfolio', 'History'],
  '/dividends':  ['Portfolio', 'Dividends'],
  '/watchlist':  ['Intelligence', 'Watchlist'],
  '/screener':   ['Intelligence', 'Screener'],
  '/charts':     ['Intelligence', 'Charts'],
  '/predictions':['Intelligence', 'AI Signals'],
  '/market':     ['Market', 'Market Hub'],
  '/earnings':   ['Market', 'Earnings'],
  '/congress':   ['Market', 'Congress'],
  '/insider':    ['Market', 'Insider'],
  '/journal':    ['Tools', 'Journal'],
  '/paper':      ['Tools', 'Simulator'],
  '/settings':   ['Tools', 'Settings'],
};

export default function Topbar() {
  const location = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [hoveringRefresh, setHoveringRefresh] = useState(false);

  const pathKey = `/${location.pathname.split('/')[1]}`;
  const [section, pageName] = PAGE_NAMES[location.pathname] || PAGE_NAMES[pathKey] || ['Portfolio', 'Dashboard'];

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await axios.post(`${BASE}/refresh/all`).catch(() => {});
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <div style={{
      height: 52,
      flexShrink: 0,
      background: 'rgba(6,11,20,0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>

      {/* Left — breadcrumb + page name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: '#3d5070',
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '-0.01em',
        }}>
          {section}
        </span>
        <span style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.12)',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1,
          marginTop: 1,
        }}>
          /
        </span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #eef2f7 30%, #8b9dc3 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          {pageName}
        </span>
      </div>

      {/* Right — market pills, clock, refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MarketPill label="NYSE" nyse={true} />
        <MarketPill label="LSE"  nyse={false} />
        <Divider />
        <Clock />
        <Divider />

        {/* Refresh button — icon only, circular ghost */}
        <button
          onClick={refresh}
          onMouseEnter={() => setHoveringRefresh(true)}
          onMouseLeave={() => setHoveringRefresh(false)}
          title="Refresh data"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: hoveringRefresh ? 'rgba(79,131,247,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${hoveringRefresh ? 'rgba(79,131,247,0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: hoveringRefresh ? '#4f83f7' : '#3d5070',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            outline: 'none',
            flexShrink: 0,
          }}
        >
          <RefreshCw
            size={13}
            strokeWidth={2}
            style={{
              animation: refreshing ? 'spin 0.9s linear infinite' : 'none',
              transition: 'color 150ms ease',
            }}
          />
        </button>
      </div>
    </div>
  );
}
