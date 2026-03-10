import { motion } from 'framer-motion';
import { LayoutDashboard, TrendingUp, BarChart3, Cpu, History, Coins, Settings, Building2, Eye } from 'lucide-react';

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'positions', label: 'Positions', icon: TrendingUp },
  { id: 'charts', label: 'Charts', icon: BarChart3 },
  { id: 'predictions', label: 'AI Signals', icon: Cpu },
  { id: 'congress', label: 'Congress', icon: Building2 },
  { id: 'insider', label: 'Insider', icon: Eye },
  { id: 'history', label: 'History', icon: History },
  { id: 'dividends', label: 'Dividends', icon: Coins },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ active, onNav }) {
  return (
    <div style={{ width: 224, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '24px 12px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '4px 12px 28px' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 500, color: 'var(--accent)', letterSpacing: 1 }}>T212</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: 1.5, marginTop: 2 }}>Portfolio Pro</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <motion.div key={id} onClick={() => onNav(id)} whileTap={{ scale: 0.97 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', position: 'relative', background: isActive ? 'var(--accent-dim)' : 'transparent', color: isActive ? 'var(--accent)' : 'var(--text-2)', transition: 'all 0.15s', fontWeight: isActive ? 600 : 400, fontSize: 14 }}>
              {isActive && <motion.div layoutId="sidebar-active" style={{ position: 'absolute', inset: 0, borderRadius: 10, border: '1px solid var(--accent-border)', background: 'var(--accent-dim)' }} transition={{ duration: 0.2 }} />}
              <Icon size={15} style={{ position: 'relative', flexShrink: 0 }} />
              <span style={{ position: 'relative' }}>{label}</span>
            </motion.div>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 12px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Auto-syncing every 30s</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gain)', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 11, color: 'var(--gain)', fontWeight: 500 }}>Live</span>
        </div>
      </div>
    </div>
  );
}
