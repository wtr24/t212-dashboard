import { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { CheckCircle, XCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

function ApiKeyInput({ label, placeholder }) {
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type={show ? 'text' : 'password'} value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'DM Mono, monospace', transition: 'border-color 0.15s' }} />
        <button onClick={() => setShow(s => !s)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-2)', display: 'flex', alignItems: 'center' }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function RefreshBtn({ label, source }) {
  const [status, setStatus] = useState(null);
  const run = async () => {
    setStatus('loading');
    try {
      await axios.post(`${BASE}/refresh/${source}`);
      setStatus('ok');
    } catch { setStatus('err'); }
    setTimeout(() => setStatus(null), 3000);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</span>
      <button onClick={run} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '6px 14px', color: 'var(--accent)', fontSize: 12, fontWeight: 500, transition: 'all 0.15s' }}>
        <RefreshCw size={12} className={status === 'loading' ? 'spin' : ''} /> Refresh
      </button>
      {status === 'ok' && <CheckCircle size={16} color="var(--gain)" />}
      {status === 'err' && <XCircle size={16} color="var(--loss)" />}
    </div>
  );
}

export default function Settings() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Settings</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20, color: 'var(--text)' }}>API Keys</div>
          <ApiKeyInput label="Trading 212 API Key" placeholder="Paste your T212 API key..." />
          <ApiKeyInput label="T212 API Secret" placeholder="Paste your T212 API secret..." />
          <ApiKeyInput label="Groq API Key" placeholder="Paste your Groq API key..." />
          <ApiKeyInput label="Alpha Vantage Key" placeholder="Paste your Alpha Vantage key..." />
          <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.8, padding: '12px 14px', background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
            API keys are stored in the server .env file. Restart the server after updating.<br />
            T212: Settings → API → Generate key<br />
            Groq: console.groq.com (free) · Alpha Vantage: alphavantage.co (free)
          </div>
        </motion.div>

        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20, color: 'var(--text)' }}>Manual Refresh</div>
          <RefreshBtn label="Portfolio & Positions" source="portfolio" />
          <RefreshBtn label="Market Data" source="market" />
          <RefreshBtn label="Community Sentiment" source="community" />
          <RefreshBtn label="AI Analysis" source="analysis" />
          <RefreshBtn label="All Data Sources" source="all" />
        </motion.div>
      </div>

      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>NAS Deployment</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: 16, lineHeight: 2 }}>
          <div style={{ color: 'var(--text-3)' }}># One-command NAS deploy (port 3002)</div>
          <div>cd /volume1/docker/t212-dashboard</div>
          <div>docker compose -f nas-deploy/docker-compose.yml up -d</div>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)' }}>
          Dashboard available at: <span style={{ color: 'var(--accent)', fontWeight: 500 }}>http://your-nas-ip:3002</span>
        </div>
      </motion.div>
    </div>
  );
}
