import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Positions from './pages/Positions';
import Charts from './pages/Charts';
import Predictions from './pages/Predictions';
import History from './pages/History';
import Dividends from './pages/Dividends';
import Settings from './pages/Settings';
import CongressTracker from './pages/CongressTracker';
import InsiderTracker from './pages/InsiderTracker';
import Earnings from './pages/Earnings';
import Research from './pages/Research';
import Watchlist from './pages/Watchlist';
import Screener from './pages/Screener';
import MarketHub from './pages/MarketHub';
import Journal from './pages/Journal';

function ResearchSearch() {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const popular = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META', 'GOOGL'];
  const go = (t) => { if (t.trim()) nav('/research/' + t.trim().toUpperCase()); };
  return (
    <div style={{ maxWidth: 560, margin: '80px auto 0', textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Stock Research</div>
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 32 }}>AI-powered analysis · earnings · technicals · news · insider activity</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && go(q)}
          placeholder="Enter ticker symbol (e.g. AAPL)"
          style={{ flex: 1, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', fontSize: 15, outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
          autoFocus
        />
        <button onClick={() => go(q)} style={{ padding: '12px 20px', borderRadius: 10, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Search</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24 }}>
        {popular.map(t => (
          <button key={t} onClick={() => go(t)} style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#475569' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 72, fontWeight: 800, color: 'rgba(59,130,246,0.2)', lineHeight: 1 }}>404</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#94a3b8', marginTop: 12 }}>Page not found</div>
      <a href="/dashboard" style={{ marginTop: 20, padding: '8px 20px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Go to Dashboard</a>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} style={{ flex: 1 }}>
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/positions" element={<Positions />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/charts/:ticker" element={<Charts />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/signals" element={<Navigate to="/predictions" replace />} />
          <Route path="/congress" element={<CongressTracker />} />
          <Route path="/insider" element={<InsiderTracker />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/market" element={<MarketHub />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/research" element={<ResearchSearch />} />
          <Route path="/research/:ticker" element={<Research />} />
          <Route path="/history" element={<History />} />
          <Route path="/dividends" element={<Dividends />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Topbar />
          <main style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <AnimatedRoutes />
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
