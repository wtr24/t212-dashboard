import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, TrendingUp, BarChart3, Brain, Building2,
  Eye, History, Coins, Settings, CalendarDays, Search, Globe,
  SlidersHorizontal, BookOpen, FlaskConical,
} from 'lucide-react';

const navGroups = [
  {
    label: 'PORTFOLIO',
    items: [
      { to: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
      { to: '/positions',  label: 'Positions',  icon: TrendingUp },
      { to: '/history',    label: 'History',    icon: History },
      { to: '/dividends',  label: 'Dividends',  icon: Coins },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { to: '/watchlist',   label: 'Watchlist', icon: Eye },
      { to: '/screener',    label: 'Screener',  icon: SlidersHorizontal },
      { to: '/charts',      label: 'Charts',    icon: BarChart3 },
      { to: '/predictions', label: 'AI Signals', icon: Brain },
    ],
  },
  {
    label: 'MARKET',
    items: [
      { to: '/market',   label: 'Market Hub', icon: Globe },
      { to: '/earnings', label: 'Earnings',   icon: CalendarDays },
      { to: '/congress', label: 'Congress',   icon: Building2 },
      { to: '/insider',  label: 'Insider',    icon: Search },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { to: '/journal',  label: 'Journal',   icon: BookOpen },
      { to: '/paper',    label: 'Simulator', icon: FlaskConical },
      { to: '/settings', label: 'Settings',  icon: Settings },
    ],
  },
];

const S = {
  sidebar: {
    width: 224,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(6,11,20,0.98)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    height: '100vh',
    position: 'sticky',
    top: 0,
    overflow: 'hidden',
  },

  logoArea: {
    padding: '22px 18px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
    textDecoration: 'none',
    display: 'block',
  },

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    background: 'linear-gradient(135deg, #4f83f7 0%, #6d42d4 100%)',
    boxShadow: '0 0 12px rgba(79,131,247,0.45), 0 0 0 1px rgba(79,131,247,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  logoIconInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.9)',
    boxShadow: '0 0 6px rgba(255,255,255,0.6)',
  },

  logoText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: 3,
    background: 'linear-gradient(135deg, #eef2f7 0%, #8b9dc3 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
  },

  logoSub: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.28em',
    color: '#1e3050',
    marginTop: 7,
    fontFamily: "'Inter', sans-serif",
    textTransform: 'uppercase',
  },

  navScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 10px 0',
    scrollbarWidth: 'none',
  },

  groupLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.28em',
    color: '#1e3050',
    padding: '14px 8px 5px',
    textTransform: 'uppercase',
    fontFamily: "'Inter', sans-serif",
    userSelect: 'none',
  },

  navGroup: {
    marginBottom: 4,
  },

  navItem: (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 10px',
    borderRadius: 8,
    cursor: 'pointer',
    position: 'relative',
    color: isActive ? '#4f83f7' : '#3d5070',
    fontWeight: isActive ? 600 : 400,
    fontSize: 13,
    letterSpacing: '-0.01em',
    textDecoration: 'none',
    transition: 'color 150ms ease',
    fontFamily: "'Inter', sans-serif",
    lineHeight: 1,
    overflow: 'hidden',
  }),

  activeBg: {
    position: 'absolute',
    inset: 0,
    borderRadius: 8,
    background: 'rgba(79,131,247,0.12)',
    border: '1px solid rgba(79,131,247,0.18)',
    borderTop: '1px solid rgba(79,131,247,0.22)',
  },

  activeBar: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 3,
    height: 18,
    background: '#4f83f7',
    borderRadius: '0 3px 3px 0',
    boxShadow: '0 0 10px rgba(79,131,247,0.9)',
  },

  statusArea: {
    flexShrink: 0,
    padding: '14px 18px 18px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#22c55e',
    animation: 'livePulse 2s ease-in-out infinite',
    flexShrink: 0,
  },

  liveRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
  },

  liveText: {
    fontSize: 11,
    fontWeight: 500,
    color: '#22c55e',
    fontFamily: "'Inter', sans-serif",
    letterSpacing: '-0.01em',
  },

  versionText: {
    fontSize: 10,
    color: '#1e3050',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.04em',
  },
};

function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink to={to} style={{ textDecoration: 'none', display: 'block' }}>
      {({ isActive }) => (
        <motion.div
          whileTap={{ scale: 0.97 }}
          style={S.navItem(isActive)}
          onMouseEnter={e => {
            if (!isActive) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = '#8b9dc3';
            }
          }}
          onMouseLeave={e => {
            if (!isActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#3d5070';
            }
          }}
        >
          {isActive && (
            <motion.div
              layoutId="sidebar-pill"
              style={S.activeBg}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            />
          )}
          {isActive && <div style={S.activeBar} />}
          <Icon size={14} style={{ position: 'relative', flexShrink: 0, strokeWidth: isActive ? 2.2 : 1.8 }} />
          <span style={{ position: 'relative' }}>{label}</span>
        </motion.div>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <div style={S.sidebar}>
      {/* Logo */}
      <NavLink to="/dashboard" style={S.logoArea}>
        <div style={S.logoRow}>
          <div style={S.logoIcon}>
            <div style={S.logoIconInner} />
          </div>
          <span style={S.logoText}>T212</span>
        </div>
        <div style={S.logoSub}>Intelligence</div>
      </NavLink>

      {/* Nav */}
      <div style={S.navScroll}>
        {navGroups.map(group => (
          <div key={group.label} style={S.navGroup}>
            <div style={S.groupLabel}>{group.label}</div>
            {group.items.map(item => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div style={S.statusArea}>
        <div style={S.liveRow}>
          <div style={S.liveDot} />
          <span style={S.liveText}>Live · 30s</span>
        </div>
        <div style={S.versionText}>v2.1</div>
      </div>
    </div>
  );
}
