const axios = require('axios');
const { upsertEarning } = require('../services/earningsService');
const { query } = require('../models/db');
const cache = require('../services/cache');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchYahooEarnings(ticker) {
  try {
    const res = await axios.get(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}`, {
      params: { modules: 'calendarEvents,earnings,earningsTrend,price' },
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      timeout: 12000,
    });
    return res.data?.quoteSummary?.result?.[0] || null;
  } catch { return null; }
}

function parseQuarterToDate(dateStr) {
  const m = String(dateStr).match(/^(\d)Q(\d{4})/);
  if (!m) return null;
  const q = parseInt(m[1]); const yr = parseInt(m[2]);
  const endMonth = { 1: '03', 2: '06', 3: '09', 4: '12' }[q];
  const endDay = { 1: '31', 2: '30', 3: '30', 4: '31' }[q];
  const reportYear = q === 4 ? yr + 1 : yr;
  const reportMonth = q === 4 ? '02' : endMonth;
  return `${reportYear}-${reportMonth}-${endDay}`;
}

function parseQuarterLabel(dateStr) {
  const m = String(dateStr).match(/^(\d)Q(\d{4})/);
  if (!m) return dateStr;
  return `Q${m[1]} ${m[2]}`;
}

async function processTicker(ticker, company) {
  const data = await fetchYahooEarnings(ticker);
  if (!data) return 0;

  let count = 0;
  const companyName = company || data.price?.longName || data.price?.shortName || ticker;

  const quarterly = data.earnings?.earningsChart?.quarterly || [];
  for (const q of quarterly) {
    if (!q.date) continue;
    const reportDate = parseQuarterToDate(q.date) || new Date().toISOString().split('T')[0];
    const epsEst = q.estimate?.raw ?? null;
    const epsAct = q.actual?.raw ?? null;
    const surprise = epsAct != null && epsEst != null ? epsAct - epsEst : null;
    const surprisePct = epsEst && surprise != null ? (surprise / Math.abs(epsEst)) * 100 : null;
    await upsertEarning({
      ticker, company: companyName, report_date: reportDate,
      fiscal_quarter: parseQuarterLabel(q.date),
      fiscal_year: parseInt(String(q.date).match(/\d{4}/)?.[0] || 2025),
      eps_estimate: epsEst, eps_actual: epsAct,
      eps_surprise: surprise, eps_surprise_pct: surprisePct,
      status: epsAct != null ? 'reported' : 'upcoming',
      source: 'yahoo',
    }).catch(() => {});
    count++;
  }

  const upcomingTs = data.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
  if (upcomingTs) {
    const d = new Date(upcomingTs * 1000);
    const reportDate = d.toISOString().split('T')[0];
    const trend = data.earningsTrend?.trend?.[0] || {};
    const epsEst = trend.earningsEstimate?.avg?.raw ?? null;
    const revEst = trend.revenueEstimate?.avg?.raw ?? null;
    await upsertEarning({
      ticker, company: companyName, report_date: reportDate,
      fiscal_year: d.getFullYear(), eps_estimate: epsEst,
      revenue_estimate: revEst ? Math.round(revEst) : null,
      status: 'upcoming', source: 'yahoo',
    }).catch(() => {});
    count++;
  }

  return count;
}

async function getTickersToScrape() {
  const [portfolio, sp500] = await Promise.all([
    query('SELECT DISTINCT ticker FROM positions').catch(() => ({ rows: [] })),
    query('SELECT ticker, company FROM sp500_stocks LIMIT 150').catch(() => ({ rows: [] })),
  ]);
  const map = new Map();
  for (const r of sp500.rows) map.set(r.ticker, r.company);
  for (const r of portfolio.rows) {
    const clean = r.ticker.replace(/[_](US|UK|EQ|NASDAQ|NYSE|LSE|ALL)[_A-Z]*/g, '');
    if (!map.has(clean)) map.set(clean, null);
  }
  return Array.from(map.entries()).map(([ticker, company]) => ({ ticker, company }));
}

async function seedIfEmpty() {
  const { rows } = await query('SELECT COUNT(*) as c FROM earnings_calendar').catch(() => ({ rows: [{ c: '0' }] }));
  if (parseInt(rows[0].c) >= 5) return;

  const now = new Date();
  const upcomingSeeds = [
    { ticker: 'NVDA', company: 'NVIDIA Corporation', days: 14, eps: 0.78, time: 'AMC' },
    { ticker: 'MSFT', company: 'Microsoft Corporation', days: 21, eps: 3.10, time: 'AMC' },
    { ticker: 'AAPL', company: 'Apple Inc.', days: 30, eps: 1.95, time: 'AMC' },
    { ticker: 'TSLA', company: 'Tesla Inc.', days: 35, eps: 0.57, time: 'AMC' },
    { ticker: 'META', company: 'Meta Platforms Inc.', days: 40, eps: 5.10, time: 'AMC' },
    { ticker: 'GOOGL', company: 'Alphabet Inc.', days: 42, eps: 2.10, time: 'AMC' },
    { ticker: 'AMZN', company: 'Amazon.com Inc.', days: 44, eps: 1.35, time: 'AMC' },
    { ticker: 'PLTR', company: 'Palantir Technologies', days: 50, eps: 0.12, time: 'BMO' },
    { ticker: 'JPM', company: 'JPMorgan Chase', days: 28, eps: 4.32, time: 'BMO' },
    { ticker: 'AMD', company: 'Advanced Micro Devices', days: 38, eps: 1.05, time: 'AMC' },
  ];
  for (const e of upcomingSeeds) {
    const d = new Date(now); d.setDate(d.getDate() + e.days);
    await upsertEarning({ ticker: e.ticker, company: e.company, report_date: d.toISOString().split('T')[0], report_time: e.time, fiscal_quarter: 'Q1 2026', fiscal_year: 2026, eps_estimate: e.eps, status: 'upcoming', source: 'seed' }).catch(() => {});
  }

  const historicalSeeds = [
    { ticker: 'MSFT', company: 'Microsoft', days: -60, est: 2.94, act: 3.12, q: 'Q2 2025' },
    { ticker: 'AAPL', company: 'Apple', days: -55, est: 1.60, act: 2.40, q: 'Q1 2025' },
    { ticker: 'NVDA', company: 'NVIDIA', days: -45, est: 0.66, act: 0.89, q: 'Q4 2024' },
    { ticker: 'TSLA', company: 'Tesla', days: -50, est: 0.42, act: 0.73, q: 'Q4 2024' },
    { ticker: 'META', company: 'Meta', days: -52, est: 4.96, act: 8.02, q: 'Q4 2024' },
  ];
  for (const e of historicalSeeds) {
    const d = new Date(now); d.setDate(d.getDate() + e.days);
    const surprise = e.act - e.est;
    await upsertEarning({ ticker: e.ticker, company: e.company, report_date: d.toISOString().split('T')[0], report_time: 'AMC', fiscal_quarter: e.q, fiscal_year: 2025, eps_estimate: e.est, eps_actual: e.act, eps_surprise: surprise, eps_surprise_pct: (surprise / Math.abs(e.est)) * 100, status: 'reported', source: 'seed' }).catch(() => {});
  }
  console.log('[earnings] Seeded sample earnings data');
}

async function runEarningsScraper() {
  const lock = await cache.get('earnings:scraping').catch(() => null);
  if (lock) return { skipped: true };
  await cache.setEx('earnings:scraping', 600, '1').catch(() => {});
  try {
    const tickers = await getTickersToScrape();
    console.log(`[earnings] Scraping ${tickers.length} tickers`);
    let total = 0;
    for (let i = 0; i < tickers.length; i += 5) {
      const batch = tickers.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map(({ ticker, company }) => processTicker(ticker, company)));
      for (const r of results) if (r.status === 'fulfilled') total += r.value;
      if (i + 5 < tickers.length) await sleep(1200);
    }
    await seedIfEmpty();
    console.log(`[earnings] Saved ${total} records`);
    return { count: total };
  } finally {
    await cache.del('earnings:scraping').catch(() => {});
  }
}

module.exports = { runEarningsScraper, seedIfEmpty };
