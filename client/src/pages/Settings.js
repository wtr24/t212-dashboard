import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { CheckCircle, XCircle, RefreshCw, Eye, EyeOff, Sparkles, ChevronDown, ChevronUp, Loader, Play } from 'lucide-react';

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

function EarningsAiSection() {
  const [enabled, setEnabled] = useState(true);
  const [runTime, setRunTime] = useState('07:00');
  const [aiStatus, setAiStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showGeminiInfo, setShowGeminiInfo] = useState(false);
  const [pollInterval, setPollInterval] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/settings`)
      .then(r => r.json())
      .then(s => {
        if (s.earnings_ai_enabled != null) setEnabled(s.earnings_ai_enabled !== 'false');
        if (s.earnings_ai_run_time) setRunTime(s.earnings_ai_run_time);
      })
      .catch(() => {});
    refreshStatus();
  }, []);

  const refreshStatus = () => {
    fetch(`${BASE}/earnings/ai-status`)
      .then(r => r.json())
      .then(s => { setAiStatus(s); setRunning(s.isRunning); })
      .catch(() => {});
  };

  // Poll while running
  useEffect(() => {
    if (running) {
      const id = setInterval(() => {
        fetch(`${BASE}/earnings/ai-status`)
          .then(r => r.json())
          .then(s => {
            setAiStatus(s);
            if (!s.isRunning) { setRunning(false); clearInterval(id); }
          })
          .catch(() => {});
      }, 3000);
      setPollInterval(id);
      return () => clearInterval(id);
    }
  }, [running]);

  const saveSettings = async () => {
    setSaveStatus('saving');
    try {
      await fetch(`${BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ earnings_ai_enabled: String(enabled), earnings_ai_run_time: runTime }),
      });
      setSaveStatus('ok');
    } catch { setSaveStatus('err'); }
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const runNow = async () => {
    try {
      const r = await fetch(`${BASE}/earnings/ai-run`, { method: 'POST' });
      const j = await r.json();
      if (j.triggered) { setRunning(true); refreshStatus(); }
    } catch {}
  };

  return (
    <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} style={{ padding: 24, gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Sparkles size={18} color="#6366f1" />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Earnings AI Analysis</div>
        <span style={{ fontSize: 11, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>Gemini Flash 2.0</span>
      </div>

      {/* Status bar */}
      {aiStatus && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Last Run', value: aiStatus.lastRun || 'Never' },
            { label: 'Analysed', value: aiStatus.lastRunCount ? `${aiStatus.lastRunCount} stocks` : '—' },
            { label: 'Scheduled', value: aiStatus.runTime || '07:00' },
            { label: 'Status', value: aiStatus.isRunning ? 'Running...' : (aiStatus.enabled ? 'Enabled' : 'Disabled'), color: aiStatus.isRunning ? '#f59e0b' : (aiStatus.enabled ? '#10b981' : 'var(--text-3)') },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--text)', fontFamily: label === 'Last Run' || label === 'Scheduled' ? 'JetBrains Mono, monospace' : 'inherit' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Enable toggle */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Enable Daily Analysis</div>
          <button
            onClick={() => setEnabled(e => !e)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: enabled ? 'rgba(16,185,129,0.1)' : 'var(--surface-2)', border: `1px solid ${enabled ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: enabled ? '#10b981' : 'var(--text-3)', fontSize: 13, fontWeight: 600, width: '100%', transition: 'all 0.2s' }}
          >
            <div style={{ width: 32, height: 18, borderRadius: 9, background: enabled ? '#10b981' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: enabled ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Run time */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Daily Run Time</div>
          <input
            type="time"
            value={runTime}
            onChange={e => setRunTime(e.target.value)}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>Server time (UTC)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {/* Save button */}
        <button onClick={saveSettings} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '9px 18px', color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {saveStatus === 'saving' ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : saveStatus === 'ok' ? <CheckCircle size={13} color="var(--gain)" /> : saveStatus === 'err' ? <XCircle size={13} color="var(--loss)" /> : null}
          Save Settings
        </button>

        {/* Run now button */}
        <button
          onClick={runNow}
          disabled={running}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: running ? 'var(--surface-2)' : 'rgba(16,185,129,0.1)', border: `1px solid ${running ? 'var(--border)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 10, padding: '9px 18px', color: running ? 'var(--text-3)' : '#10b981', fontSize: 13, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.7 : 1 }}
        >
          {running ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
          {running ? 'Analysing...' : 'Run Now (Force)'}
        </button>

        {running && (
          <button onClick={refreshStatus} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Check Status
          </button>
        )}
      </div>

      {/* Gemini API key info accordion */}
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, overflow: 'hidden' }}>
        <button
          onClick={() => setShowGeminiInfo(s => !s)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={13} color="#6366f1" /> Gemini API Key Setup</span>
          {showGeminiInfo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showGeminiInfo && (
          <div style={{ padding: '0 16px 16px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.9 }}>
            <div style={{ marginBottom: 8 }}>Add <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', color: '#6366f1' }}>GEMINI_API_KEY=your_key</code> to your <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>server/.env</code> and docker-compose environment.</div>
            <div style={{ marginBottom: 4 }}>Get a free key at <span style={{ color: '#6366f1', fontWeight: 500 }}>aistudio.google.com/app/apikey</span></div>
            <div>Free tier: 15 req/min · 1,500 req/day — sufficient for daily earnings analysis of ~30 stocks with a 2s delay between calls.</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
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

        <EarningsAiSection />
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
