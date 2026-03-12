const { query } = require('../models/db');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const API_LIMITS = {
  alphavantage: { perDay: 25,   perMin: null, minDelayMs: 2500  },
  twelvedata:   { perDay: 800,  perMin: 8,    minDelayMs: 7500  },
  fmp:          { perDay: 250,  perMin: null, minDelayMs: 500   },
  polygon:      { perDay: null, perMin: 5,    minDelayMs: 12000 },
  yahoofinance: { perDay: 2000, perMin: null, minDelayMs: 350   },
};

const lastRequestAt = {};

async function canCall(apiName) {
  const limit = API_LIMITS[apiName];
  if (!limit) return true;
  if (limit.perDay) {
    const r = await query(
      'SELECT requests_today FROM api_usage WHERE api_name=$1 AND date=CURRENT_DATE',
      [apiName]
    ).catch(() => ({ rows: [] }));
    const used = r.rows[0]?.requests_today || 0;
    if (used >= limit.perDay) {
      console.log(`[quota] ${apiName} exhausted (${used}/${limit.perDay})`);
      return false;
    }
  }
  if (limit.minDelayMs && lastRequestAt[apiName]) {
    const elapsed = Date.now() - lastRequestAt[apiName];
    if (elapsed < limit.minDelayMs) await sleep(limit.minDelayMs - elapsed);
  }
  return true;
}

async function recordCall(apiName) {
  lastRequestAt[apiName] = Date.now();
  await query(
    `INSERT INTO api_usage (api_name, date, requests_today, last_request_at)
     VALUES ($1, CURRENT_DATE, 1, NOW())
     ON CONFLICT (api_name, date) DO UPDATE
     SET requests_today = api_usage.requests_today + 1, last_request_at = NOW()`,
    [apiName]
  ).catch(() => {});
}

async function withRateLimit(apiName, fn) {
  const ok = await canCall(apiName);
  if (!ok) throw Object.assign(new Error(`QUOTA_EXHAUSTED:${apiName}`), { quotaExhausted: true });
  const result = await fn();
  await recordCall(apiName);
  return result;
}

async function getQuotaStatus() {
  const r = await query(
    'SELECT api_name, requests_today FROM api_usage WHERE date = CURRENT_DATE'
  ).catch(() => ({ rows: [] }));
  const usageMap = Object.fromEntries(r.rows.map(row => [row.api_name, row.requests_today || 0]));
  return Object.fromEntries(
    Object.entries(API_LIMITS).map(([api, limit]) => {
      const used = usageMap[api] || 0;
      const total = limit.perDay || null;
      const remaining = total ? total - used : null;
      const pct = total ? Math.round((used / total) * 100) : 0;
      let status = 'ready';
      if (total) {
        if (pct >= 100) status = 'exhausted';
        else if (pct >= 90) status = 'critical';
        else if (pct >= 70) status = 'low';
        else if (used > 0) status = 'active';
      } else {
        status = used > 0 ? 'active' : 'ready';
      }
      return [api, { used, limit: total || 'unlimited', remaining: remaining !== null ? remaining : 'unlimited', pct, status }];
    })
  );
}

module.exports = { canCall, recordCall, withRateLimit, getQuotaStatus, API_LIMITS };
