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

const pages = { dashboard: Dashboard, positions: Positions, charts: Charts, predictions: Predictions, history: History, dividends: Dividends, settings: Settings };

export default function App() {
  const [page, setPage] = useState('dashboard');
  const Page = pages[page] || Dashboard;
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={page} onNav={setPage} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <Page />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
