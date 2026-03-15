const https = require('https');
const cache = require('./cache');

// VIX via Yahoo Finance (no key needed) - use yahoo-finance2 if available
async function getVix() {
  const ck = 'macro:vix';
  const c = await cache.get(ck).catch(() => null);
  if (c) return JSON.parse(c);
  try {
    const yf = require('yahoo-finance2').default;
    const q = await yf.quote('^VIX', {}, { validateResult: false });
    const val = { value: q.regularMarketPrice, prev: q.regularMarketPreviousClose, change: q.regularMarketChangePercent };
    await cache.setEx(ck, 900, JSON.stringify(val)).catch(() => {});
    return val;
  } catch { return { value: null, prev: null, change: null }; }
}

// Fear & Greed from CNN (free, no key)
async function getFearGreed() {
  const ck = 'macro:feargreed';
  const c = await cache.get(ck).catch(() => null);
  if (c) return JSON.parse(c);
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'production.dataviz.cnn.io',
      path: '/index/fearandgreed/graphdata',
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', async () => {
        try {
          const j = JSON.parse(data);
          const score = j?.fear_and_greed?.score;
          const rating = j?.fear_and_greed?.rating;
          const result = { score: Math.round(score), rating };
          await cache.setEx(ck, 3600, JSON.stringify(result)).catch(() => {});
          resolve(result);
        } catch { resolve({ score: null, rating: null }); }
      });
    });
    req.on('error', () => resolve({ score: null, rating: null }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ score: null, rating: null }); });
    req.end();
  });
}

// Sector ETF performance via Yahoo Finance
async function getSectorPerformance() {
  const ck = 'macro:sectors';
  const c = await cache.get(ck).catch(() => null);
  if (c) return JSON.parse(c);
  try {
    const yf = require('yahoo-finance2').default;
    const sectorETFs = [
      { ticker: 'XLK', name: 'Technology' },
      { ticker: 'XLF', name: 'Financials' },
      { ticker: 'XLE', name: 'Energy' },
      { ticker: 'XLV', name: 'Healthcare' },
      { ticker: 'XLY', name: 'Consumer Disc.' },
      { ticker: 'XLP', name: 'Consumer Staples' },
      { ticker: 'XLI', name: 'Industrials' },
      { ticker: 'XLB', name: 'Materials' },
      { ticker: 'XLRE', name: 'Real Estate' },
      { ticker: 'XLU', name: 'Utilities' },
      { ticker: 'XLC', name: 'Communication' },
    ];
    const results = [];
    for (const s of sectorETFs) {
      try {
        const q = await yf.quote(s.ticker, {}, { validateResult: false });
        results.push({ ...s, changePercent: q.regularMarketChangePercent, price: q.regularMarketPrice });
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    await cache.setEx(ck, 1800, JSON.stringify(results)).catch(() => {});
    return results;
  } catch { return []; }
}

// Market status (NYSE open/closed)
function getMarketStatus() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const h = et.getHours(), m = et.getMinutes();
  const mins = h * 60 + m;
  const isWeekday = day >= 1 && day <= 5;
  const nyseOpen = isWeekday && mins >= 570 && mins < 960; // 9:30am - 4pm
  const lseOpen = (() => {
    const uk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const uh = uk.getHours(), um = uk.getMinutes();
    const ud = uk.getDay();
    const um2 = uh * 60 + um;
    return ud >= 1 && ud <= 5 && um2 >= 510 && um2 < 990; // 8:30am - 4:30pm
  })();
  return { nyseOpen, lseOpen };
}

async function getMacroContext() {
  const ck = 'macro:context';
  const c = await cache.get(ck).catch(() => null);
  if (c) return JSON.parse(c);
  const [vixR, fgR] = await Promise.allSettled([getVix(), getFearGreed()]);
  const result = {
    vix: vixR.status === 'fulfilled' ? vixR.value : { value: null },
    fearGreed: fgR.status === 'fulfilled' ? fgR.value : { score: null },
    marketStatus: getMarketStatus(),
    updatedAt: new Date().toISOString(),
  };
  await cache.setEx(ck, 600, JSON.stringify(result)).catch(() => {});
  return result;
}

module.exports = { getVix, getFearGreed, getSectorPerformance, getMarketStatus, getMacroContext };
