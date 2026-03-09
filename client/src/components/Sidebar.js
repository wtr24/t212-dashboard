import { motion } from 'framer-motion';
import { LayoutDashboard, TrendingUp, BarChart3, Cpu, History, Coins, Settings } from 'lucide-react';

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'positions', label: 'Positions', icon: TrendingUp },
  { id: 'charts', label: 'Charts', icon: BarChart3 },
  { id: 'predictions', label: 'Predictions', icon: Cpu },
  { id: 'history', label: 'History', icon: History },
  { id: 'dividends', label: 'Dividends', icon: Coins },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const s = {
  sidebar: { width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 },
  logo: { fontFamily: 'Space Mono, monospace', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 24, padding: '0 8px', letterSpacing: 2 },
  item: (active) => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', background: active ? 'var(--accent-glow)' : 'transparent', color: active ? 'var(--accent)' : 'var(--muted)', border: active ? '1px solid rgba(0,255,136,0.2)' : '1px solid transparent', fontSize: 14, fontWeight: active ? 600 : 400 }),
};

export default function Sidebar({ active, onNav }) {
  return (
    <div style={s.sidebar}>
      <div style={s.logo}>T212 PRO</div>
      {nav.map(({ id, label, Icon = item => item.icon }) => {
        const NavIcon = nav.find(n => n.id === id)?.icon;
        return (
          <motion.div key={id} style={s.item(active === id)} onClick={() => onNav(id)} whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}>
            {NavIcon && <NavIcon size={16} />}
            <span>{label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
