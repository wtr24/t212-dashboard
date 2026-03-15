import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, TrendingUp, BarChart3, Brain, Building2, Eye, History, Coins, Settings, CalendarDays, Search, Globe, SlidersHorizontal, BookOpen, FlaskConical } from 'lucide-react';

const navGroups = [
  {
    label: 'PORTFOLIO',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/positions', label: 'Positions', icon: TrendingUp },
      { to: '/history', label: 'History', icon: History },
      { to: '/dividends', label: 'Dividends', icon: Coins },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { to: '/watchlist', label: 'Watchlist', icon: Eye },
      { to: '/screener', label: 'Screener', icon: SlidersHorizontal },
      { to: '/charts', label: 'Charts', icon: BarChart3 },
      { to: '/predictions', label: 'AI Signals', icon: Brain },
    ],
  },
  {
    label: 'MARKET',
    items: [
      { to: '/market', label: 'Market Hub', icon: Globe },
      { to: '/earnings', label: 'Earnings', icon: CalendarDays },
      { to: '/congress', label: 'Congress', icon: Building2 },
      { to: '/insider', label: 'Insider', icon: Search },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { to: '/journal', label: 'Journal', icon: BookOpen },
      { to: '/paper', label: 'Simulator', icon: FlaskConical },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function Sidebar() {
  return (
    <div style={{ width: 220, background: 'rgba(8,13,26,0.95)', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '24px 12px', display: 'flex', flexDirection: 'column', flexShrink: 0, backdropFilter: 'blur(20px)' }}>
      <NavLink to="/dashboard" style={{ textDecoration: 'none', padding: '4px 12px 28px', display: 'block' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 2 }}>T212</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: 1.5, marginTop: 2, fontFamily: 'Outfit, sans-serif' }}>PORTFOLIO PRO</div>
      </NavLink>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', flex: 1 }}>
        {navGroups.map(group => (
          <div key={group.label} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: 2, padding: '8px 12px 4px' }}>{group.label}</div>
            {group.items.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
                {({ isActive }) => (
                  <motion.div whileTap={{ scale: 0.97 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', position: 'relative', background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent', color: isActive ? '#3b82f6' : 'var(--text-3)', transition: 'all 0.15s', fontWeight: isActive ? 600 : 400, fontSize: 13 }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text)'; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; } }}>
                    {isActive && <motion.div layoutId="sidebar-active" style={{ position: 'absolute', inset: 0, borderRadius: 10, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)' }} transition={{ duration: 0.2 }} />}
                    {isActive && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: '#3b82f6', borderRadius: '0 3px 3px 0', boxShadow: '0 0 8px rgba(59,130,246,0.8)' }} />}
                    <Icon size={15} style={{ position: 'relative', flexShrink: 0 }} />
                    <span style={{ position: 'relative' }}>{label}</span>
                  </motion.div>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.6)', animation: 'glow-pulse 2s infinite' }} />
          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>Live · Auto-sync 30s</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'JetBrains Mono' }}>v2.1 · Stremax</div>
      </div>
    </div>
  );
}
