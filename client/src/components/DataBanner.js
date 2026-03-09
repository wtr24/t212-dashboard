import { useState } from 'react';
import { RefreshCw, Database, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

function age(ts) {
  if (!ts) return null;
  const secs = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

const sourceIcon = { live: <Wifi size={11} />, redis: <Wifi size={11} />, db: <Database size={11} />, error: <WifiOff size={11} />, no_key: <AlertCircle size={11} /> };
const sourceColor = { live: 'var(--gain)', redis: 'var(--gain)', db: 'var(--warning)', error: 'var(--loss)', no_key: 'var(--loss)' };
const sourceLabel = { live: 'Live from T212', redis: 'Cached', db: 'From database', error: 'API error — showing cached', no_key: 'No API key — add T212_API_KEY to .env' };

export default function DataBanner({ source, age: dataAge, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await axios.post(`${BASE}/refresh/all`);
      setLastRefresh(new Date());
      if (onRefresh) onRefresh();
    } catch {}
    setTimeout(() => setRefreshing(false), 800);
  };

  const color = sourceColor[source] || 'var(--text-2)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color, fontSize: 11, fontWeight: 600 }}>
          {sourceIcon[source] || <Wifi size={11} />}
          {sourceLabel[source] || 'Loading...'}
        </div>
        {source === 'no_key' && (
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>· Dashboard shows no real data until API key is set</span>
        )}
        {dataAge && source !== 'no_key' && (
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>· updated {age(dataAge)}</span>
        )}
        {lastRefresh && (
          <span style={{ fontSize: 11, color: 'var(--gain)' }}>· refreshed just now</span>
        )}
      </div>
      <button onClick={doRefresh} disabled={refreshing}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: refreshing ? 'var(--accent-dim)' : 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 12px', color: refreshing ? 'var(--accent)' : 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: refreshing ? 'default' : 'pointer', transition: 'all 0.15s' }}>
        <RefreshCw size={11} className={refreshing ? 'spin' : ''} />
        {refreshing ? 'Refreshing...' : 'Refresh now'}
      </button>
    </div>
  );
}
