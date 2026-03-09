import { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

function ApiKeyInput({ label, envKey, placeholder }) {
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type={show ? 'text' : 'password'} value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
          style={{ flex: 1, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'Space Mono, monospace' }} />
        <button onClick={() => setShow(s => !s)} style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>
          {show ? 'Hide' : 'Show'}
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
      <button onClick={run} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--accent)', fontSize: 12 }}>
        <RefreshCw size={12} className={status === 'loading' ? 'spin' : ''} /> Refresh
      </button>
      {status === 'ok' && <CheckCircle size={16} color="var(--accent)" />}
      {status === 'err' && <XCircle size={16} color="var(--danger)" />}
    </div>
  );
}

export default function Settings() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Settings</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <motion.div className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>API Keys</div>
          <ApiKeyInput label="Trading 212 API Key" placeholder="Paste your T212 API key..." />
          <ApiKeyInput label="Groq API Key" placeholder="Paste your Groq API key..." />
          <ApiKeyInput label="Alpha Vantage Key" placeholder="Paste your Alpha Vantage key..." />
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7, padding: '12px', background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.1)', borderRadius: 8 }}>
            API keys are stored in the server .env file. Restart the server after updating.<br />
            T212: Settings → API → Generate key<br />
            Groq: console.groq.com (free)<br />
            Alpha Vantage: alphavantage.co (free)
          </div>
        </motion.div>

        <motion.div className="glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Manual Refresh</div>
          <RefreshBtn label="Portfolio & Positions" source="portfolio" />
          <RefreshBtn label="Market Data" source="market" />
          <RefreshBtn label="Community Sentiment" source="community" />
          <RefreshBtn label="AI Analysis" source="analysis" />
          <RefreshBtn label="All Data Sources" source="all" />
        </motion.div>
      </div>

      <motion.div className="glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>NAS Deployment</div>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--accent)', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 8, padding: 16, lineHeight: 2 }}>
          <div style={{ color: 'var(--muted)' }}># One-command NAS deploy (port 3002)</div>
          <div>cd /volume1/docker/t212-dashboard</div>
          <div>docker compose -f nas-deploy/docker-compose.yml up -d</div>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
          Dashboard: <span style={{ color: 'var(--accent)' }}>http://your-nas-ip:3002</span>
        </div>
      </motion.div>
    </div>
  );
}
