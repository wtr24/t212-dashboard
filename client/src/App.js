import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
