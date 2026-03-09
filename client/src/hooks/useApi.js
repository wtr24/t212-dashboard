import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await axios.get(`${BASE}${path}`);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { fetch(); }, [fetch, ...deps]);

  return { data, loading, error, refetch: fetch };
}

export function usePortfolio() {
  const summary = useApi('/portfolio/summary');
  const positions = useApi('/portfolio/positions');
  const fearGreed = useApi('/market/feargreed');
  return { summary, positions, fearGreed };
}

export async function manualRefresh(source = 'all') {
  await axios.post(`${BASE}/refresh/${source}`);
}
