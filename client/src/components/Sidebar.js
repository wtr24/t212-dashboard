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
    <div style={{ width: 220, background: 'rgba(8,13,26,0.95)', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '24px 12px', display: 'flex', flexDirection: 'column', flexShrink: 0, backdropFilter: 'blur(20px)' }}>
      <div style={{ padding: '4px 12px 28px' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 2 }}>T212</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: 1.5, marginTop: 2, fontFamily: 'Outfit, sans-serif' }}>PORTFOLIO PRO</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <motion.div key={id} onClick={() => onNav(id)} whileTap={{ scale: 0.97 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', position: 'relative', background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent', color: isActive ? '#3b82f6' : 'var(--text-3)', transition: 'all 0.15s', fontWeight: isActive ? 600 : 400, fontSize: 13 }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; } }}>
              {isActive && <motion.div layoutId="sidebar-active" style={{ position: 'absolute', inset: 0, borderRadius: 10, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)' }} transition={{ duration: 0.2 }} />}
              {isActive && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, background: '#3b82f6', borderRadius: '0 3px 3px 0', boxShadow: '0 0 8px rgba(59,130,246,0.8)' }} />}
              <Icon size={15} style={{ position: 'relative', flexShrink: 0 }} />
              <span style={{ position: 'relative' }}>{label}</span>
            </motion.div>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.6)', animation: 'glow-pulse 2s infinite' }} />
          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>Live · Auto-sync 30s</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'JetBrains Mono' }}>v2.0 · Stremax</div>
      </div>
    </div>
  );
}
