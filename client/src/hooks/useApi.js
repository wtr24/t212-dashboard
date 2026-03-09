import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

export function useApi(path, { pollInterval } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef();

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

  useEffect(() => {
    fetch();
    if (pollInterval) {
      intervalRef.current = setInterval(fetch, pollInterval);
    }
    return () => clearInterval(intervalRef.current);
  }, [fetch, pollInterval]);

  return { data, loading, error, refetch: fetch };
}

export function usePortfolio() {
  const summary = useApi('/portfolio/summary', { pollInterval: 30000 });
  const positions = useApi('/portfolio/positions', { pollInterval: 60000 });
  const fearGreed = useApi('/market/feargreed', { pollInterval: 300000 });
  return { summary, positions, fearGreed };
}
