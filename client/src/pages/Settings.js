import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { CheckCircle, XCircle, RefreshCw, Eye, EyeOff, Sparkles, ChevronDown, ChevronUp, Loader, Play, Bell, Send, Activity } from 'lucide-react';

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
      .then(s => { setAiStatus(s); setRunning(s.isRunning); if (s.runTime) setRunTime(s.runTime); if (s.enabled != null) setEnabled(s.enabled); })
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

      {/* Quota bar */}
      {aiStatus && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Last Run', value: aiStatus.lastRun || 'Never' },
                { label: 'Today', value: aiStatus.lastRunCount ? `${aiStatus.lastRunCount} analysed` : '—' },
                { label: 'Model', value: aiStatus.modelInUse || 'gemini-2.5-flash' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>Daily Quota</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: aiStatus.quotaRemainingToday <= 5 ? '#ef4444' : aiStatus.quotaRemainingToday <= 10 ? '#f59e0b' : '#10b981' }}>
                {aiStatus.quotaRemainingToday}/{aiStatus.quotaTotal || 20}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>resets midnight UTC</div>
            </div>
          </div>
          <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, transition: 'width 0.4s', background: aiStatus.quotaRemainingToday <= 5 ? '#ef4444' : aiStatus.quotaRemainingToday <= 10 ? '#f59e0b' : '#10b981', width: `${Math.round(((aiStatus.quotaTotal || 20) - (aiStatus.quotaUsedToday || 0)) / (aiStatus.quotaTotal || 20) * 100)}%` }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text-3)', flexWrap: 'wrap' }}>
            {(aiStatus.waveSchedule || []).map((w, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />{w}
              </span>
            ))}
          </div>
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
        {aiStatus?.quotaRemainingToday === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12, color: '#ef4444', fontWeight: 500 }}>
            Quota exhausted · resets midnight UTC
          </div>
        ) : (
          <button
            onClick={runNow}
            disabled={running}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: running ? 'var(--surface-2)' : 'rgba(16,185,129,0.1)', border: `1px solid ${running ? 'var(--border)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 10, padding: '9px 18px', color: running ? 'var(--text-3)' : '#10b981', fontSize: 13, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.7 : 1 }}
          >
            {running ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
            {running
              ? `Analysing... (~${aiStatus?.estimatedMinsForRemaining || '?'}m)`
              : `Run Now · ${aiStatus?.quotaRemainingToday ?? '?'} of ${aiStatus?.quotaTotal ?? 20} remaining`}
          </button>
        )}

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
            <div style={{ marginBottom: 8 }}>Add <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', color: '#6366f1' }}>GEMINI_API_KEY=your_key</code> to your <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>nas-deploy/.env</code></div>
            <div style={{ marginBottom: 4 }}>Get a free key at <span style={{ color: '#6366f1', fontWeight: 500 }}>aistudio.google.com/app/apikey</span></div>
            <div style={{ marginBottom: 8, padding: '8px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
              <strong style={{ color: '#f59e0b' }}>Free tier limits:</strong> 20 analyses/day · 5/min · resets midnight UTC<br />
              News context is pre-fetched from Yahoo Finance and passed to Gemini — Gemini does <em>not</em> browse the internet on free tier.<br />
              Waves auto-analyse your top 20 priority earnings across 3 scheduled runs (06:30, 07:00, 12:00).
            </div>
            <div>Upgrade to pay-as-you-go at <span style={{ color: '#6366f1' }}>aistudio.google.com</span> for unlimited analyses (set <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>GEMINI_RPD=1000</code> env var).</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

function DiscordEarningsSection() {
  const [sendTime, setSendTime] = useState('07:00');
  const [enabled, setEnabled] = useState(true);
  const [testStatus, setTestStatus] = useState(null);
  const [sendStatus, setSendStatus] = useState(null);
  const [lastSent, setLastSent] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/settings`)
      .then(r => r.json())
      .then(s => {
        if (s.earnings_discord_time) setSendTime(s.earnings_discord_time);
        if (s.earnings_discord_enabled != null) setEnabled(s.earnings_discord_enabled !== 'false');
        if (s.discord_earnings_last_sent) setLastSent(s.discord_earnings_last_sent);
      })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ earnings_discord_time: sendTime, earnings_discord_enabled: String(enabled) }),
    }).catch(() => {});
  };

  const sendTest = async () => {
    setTestStatus('loading');
    try {
      const r = await fetch(`${BASE}/earnings/discord-test`, { method: 'POST' });
      const j = await r.json();
      setTestStatus(j.success ? 'ok' : 'err');
    } catch { setTestStatus('err'); }
    setTimeout(() => setTestStatus(null), 4000);
  };

  const sendNow = async () => {
    setSendStatus('loading');
    try {
      const r = await fetch(`${BASE}/earnings/discord-send`, { method: 'POST' });
      const j = await r.json();
      setSendStatus(j.started ? 'ok' : 'err');
    } catch { setSendStatus('err'); }
    setTimeout(() => setSendStatus(null), 5000);
  };

  return (
    <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ padding: 24, gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Bell size={18} color="#5865f2" />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Discord Earnings Alerts</div>
        <span style={{ fontSize: 11, color: '#5865f2', background: 'rgba(88,101,242,0.12)', padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>Daily 7am</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={sendTest} style={{ display: 'flex', alignItems: 'center', gap: 6, background: testStatus === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(88,101,242,0.1)', border: `1px solid ${testStatus === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(88,101,242,0.3)'}`, borderRadius: 10, padding: '8px 16px', color: testStatus === 'ok' ? '#10b981' : testStatus === 'err' ? '#ef4444' : '#5865f2', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          {testStatus === 'loading' ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : testStatus === 'ok' ? <CheckCircle size={13} /> : testStatus === 'err' ? <XCircle size={13} /> : <Send size={13} />}
          {testStatus === 'ok' ? 'Test Sent!' : testStatus === 'err' ? 'Failed — check webhook' : 'Send Test Embed'}
        </button>

        <button onClick={sendNow} style={{ display: 'flex', alignItems: 'center', gap: 6, background: sendStatus === 'ok' ? 'rgba(16,185,129,0.1)' : 'var(--surface-2)', border: `1px solid ${sendStatus === 'ok' ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: 10, padding: '8px 16px', color: sendStatus === 'ok' ? '#10b981' : sendStatus === 'loading' ? 'var(--text-3)' : 'var(--text)', fontSize: 13, fontWeight: 500, cursor: sendStatus === 'loading' ? 'not-allowed' : 'pointer' }}>
          {sendStatus === 'loading' ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : sendStatus === 'ok' ? <CheckCircle size={13} /> : <Bell size={13} />}
          {sendStatus === 'ok' ? 'Sent! Check #earnings' : sendStatus === 'loading' ? 'Sending...' : "Send Today's Earnings Now"}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Daily Send Time (London)</div>
          <input type="time" value={sendTime} onChange={e => setSendTime(e.target.value)}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box' }} />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>Runs Mon–Fri only · set AI to 06:30 for best results</div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Enable Alerts</div>
          <button onClick={() => setEnabled(e => !e)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: enabled ? 'rgba(88,101,242,0.1)' : 'var(--surface-2)', border: `1px solid ${enabled ? 'rgba(88,101,242,0.3)' : 'var(--border)'}`, borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: enabled ? '#5865f2' : 'var(--text-3)', fontSize: 13, fontWeight: 600, width: '100%', transition: 'all 0.2s' }}>
            <div style={{ width: 32, height: 18, borderRadius: 9, background: enabled ? '#5865f2' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: enabled ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={saveSettings} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(88,101,242,0.1)', border: '1px solid rgba(88,101,242,0.3)', borderRadius: 10, padding: '8px 16px', color: '#5865f2', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Save Discord Settings
        </button>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10 }}>
        Sends rich embed cards to Discord each morning: summary header → ⭐ your portfolio stocks → 🌅 BMO batch → 🌆 AMC batch.<br />
        Each card shows: ticker logo, BUY/SELL/HOLD signal, beat probability bar, AI summary, key catalysts &amp; risks.
        {lastSent && <span style={{ marginLeft: 8, color: 'var(--text-3)' }}>· Last sent: {new Date(lastSent).toLocaleString()}</span>}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

function DataSourcesSection() {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState({});

  const load = () => {
    setLoading(true);
    fetch(`${BASE}/admin/quota-status`)
      .then(r => r.json())
      .then(d => { setQuota(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const SOURCES = [
    { key: 'yahoofinance', label: 'Yahoo Finance', link: null, envVar: null, note: 'Primary source — no key needed' },
    { key: 'fmp', label: 'FMP', link: 'financialmodelingprep.com/register', envVar: 'FMP_KEY', note: '250 req/day — revenue & analyst estimates' },
    { key: 'twelvedata', label: 'Twelve Data', link: 'twelvedata.com/register', envVar: 'TWELVE_DATA_KEY', note: '800 req/day — OHLCV fallback, live quotes' },
    { key: 'polygon', label: 'Polygon.io', link: 'polygon.io/dashboard/signup', envVar: 'POLYGON_KEY', note: '5 RPM unlimited — news, prev close' },
    { key: 'alphavantage', label: 'Alpha Vantage', link: 'alphavantage.co/support/#api-key', envVar: 'ALPHA_VANTAGE_KEY', note: '25 req/day — use sparingly for portfolio only' },
  ];

  function StatusPill({ status, used, limit }) {
    const cfg = {
      ready:     { color: '#475569', bg: 'rgba(71,85,105,0.15)',  label: 'Ready' },
      active:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Active' },
      low:       { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Running Low' },
      critical:  { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'Critical' },
      exhausted: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'Exhausted · resets midnight' },
    }[status] || { color: 'var(--text-3)', bg: 'var(--surface-2)', label: status };
    return (
      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 4 }}>
        {cfg.label}
      </span>
    );
  }

  return (
    <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} style={{ padding: 24, gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={18} color="#3b82f6" />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Market Data Sources</div>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '12px 0' }}>Loading quota status...</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.5fr', gap: 0, background: 'var(--surface-2)', padding: '8px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            <span>Source</span><span>Used Today</span><span>Daily Limit</span><span>Remaining</span><span>Status</span>
          </div>
          {SOURCES.map((s, i) => {
            const q = quota?.[s.key];
            const isOpen = open[s.key];
            return (
              <div key={s.key} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <div
                  onClick={() => s.link && setOpen(o => ({ ...o, [s.key]: !o[s.key] }))}
                  style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.5fr', gap: 0, padding: '12px 16px', alignItems: 'center', cursor: s.link ? 'pointer' : 'default' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {s.label}
                    {s.link && <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{isOpen ? '▲' : '▼'}</span>}
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--text-2)' }}>{q?.used ?? '—'}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--text-2)' }}>{q?.limit ?? '—'}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--text-2)' }}>{q?.remaining ?? '—'}</span>
                  <StatusPill status={q?.status || 'ready'} used={q?.used} limit={q?.limit} />
                </div>
                {isOpen && s.link && (
                  <div style={{ padding: '0 16px 12px 16px', fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', lineHeight: 1.8 }}>
                    <div>{s.note}</div>
                    <div>Add <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3, fontFamily: 'JetBrains Mono, monospace', color: '#3b82f6' }}>{s.envVar}=your_key</code> to <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>nas-deploy/.env</code></div>
                    <div>Get free key: <span style={{ color: '#3b82f6', fontWeight: 500 }}>{s.link}</span></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
        <DiscordEarningsSection />
        <DataSourcesSection />
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
