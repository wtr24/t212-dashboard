const axios = require('axios');
const { upsertEarning } = require('../services/earningsService');
const { query } = require('../models/db');
const cache = require('../services/cache');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseEps(str) {
  if (!str || str === 'N/A') return null;
  const n = parseFloat(String(str).replace(/[$,]/g, ''));
  return isFinite(n) ? n : null;
}

function parseMarketCap(str) {
  if (!str || str === 'N/A') return null;
  const s = String(str).replace(/[$,]/g, '').toUpperCase();
  const n = parseFloat(s);
  if (s.endsWith('T')) return Math.round(n * 1e12);
  if (s.endsWith('B')) return Math.round(n * 1e9);
  if (s.endsWith('M')) return Math.round(n * 1e6);
  return Math.round(n);
}

function nasdaqTimeToCode(t) {
  if (!t || t === 'time-not-supplied') return 'TNS';
  const tl = t.toLowerCase();
  if (tl.includes('pre') || tl.includes('before') || tl.includes('bmo')) return 'BMO';
  if (tl.includes('after') || tl.includes('post') || tl.includes('amc')) return 'AMC';
  return 'TNS';
}

async function fetchNasdaqEarnings(dateStr) {
  try {
    const res = await axios.get('https://api.nasdaq.com/api/calendar/earnings', {
      params: { date: dateStr },
      headers: { 'User-Agent': UA, Accept: 'application/json,text/plain,*/*', Referer: 'https://www.nasdaq.com/' },
      timeout: 15000,
    });
    return res.data?.data?.rows || [];
  } catch (e) {
    console.error(`[earnings nasdaq] ${dateStr}: ${e.message}`);
    return [];
  }
}

async function scrapeNasdaqWeek() {
  const today = new Date();
  let total = 0;
  for (let d = 0; d <= 7; d++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + d);
    if (dt.getDay() === 0 || dt.getDay() === 6) continue;
    const dateStr = dt.toISOString().split('T')[0];
    const rows = await fetchNasdaqEarnings(dateStr);
    for (const row of rows) {
      if (!row.symbol || row.symbol === 'N/A') continue;
      const ticker = String(row.symbol).toUpperCase().trim();
      await upsertEarning({
        ticker,
        company: row.name || ticker,
        report_date: dateStr,
        report_time: nasdaqTimeToCode(row.time),
        fiscal_quarter: row.fiscalQuarterEnding || null,
        eps_estimate: parseEps(row.epsForecast),
        analyst_count: row.noOfEsts ? parseInt(row.noOfEsts) : null,
        status: 'upcoming',
        source: 'nasdaq',
      }).catch(() => {});
      total++;
    }
    if (d < 7) await sleep(500);
  }
  console.log(`[earnings nasdaq] Saved ${total} upcoming earnings`);
  return total;
}

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

async function fetchYahooEnrichment(ticker) {
  try {
    const res = await axios.get(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}`, {
      params: { modules: 'earningsTrend,financialData,defaultKeyStatistics,recommendationTrend,price' },
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      timeout: 12000,
    });
    return res.data?.quoteSummary?.result?.[0] || null;
  } catch { return null; }
}

async function enrichEarningsFromYahoo() {
  // Find upcoming earnings with missing revenue or analyst data
  const { rows } = await query(
    `SELECT DISTINCT ticker, report_date FROM earnings_calendar
     WHERE status='upcoming' AND report_date >= CURRENT_DATE
       AND (revenue_estimate IS NULL OR market_cap IS NULL)
     ORDER BY report_date ASC LIMIT 100`
  ).catch(() => ({ rows: [] }));

  if (!rows.length) {
    console.log('[earnings enrich] No tickers need enrichment');
    return 0;
  }

  // Deduplicate tickers (only need one fetch per ticker)
  const uniqueTickers = [...new Set(rows.map(r => r.ticker))];
  console.log(`[earnings enrich] Enriching ${uniqueTickers.length} tickers from Yahoo`);
  let enriched = 0;

  for (let i = 0; i < uniqueTickers.length; i += 5) {
    const batch = uniqueTickers.slice(i, i + 5);
    await Promise.allSettled(batch.map(async ticker => {
      const data = await fetchYahooEnrichment(ticker);
      if (!data) return;

      const trend = data.earningsTrend?.trend?.[0] || {};
      const fin = data.financialData || {};
      const stats = data.defaultKeyStatistics || {};
      const recTrend = data.recommendationTrend?.trend?.[0] || {};

      const revenue_estimate = trend.revenueEstimate?.avg?.raw
        ? Math.round(trend.revenueEstimate.avg.raw) : null;
      const revenue_estimate_low = trend.revenueEstimate?.low?.raw
        ? Math.round(trend.revenueEstimate.low.raw) : null;
      const revenue_estimate_high = trend.revenueEstimate?.high?.raw
        ? Math.round(trend.revenueEstimate.high.raw) : null;
      const eps_estimate_low = trend.earningsEstimate?.low?.raw ?? null;
      const eps_estimate_high = trend.earningsEstimate?.high?.raw ?? null;
      const analyst_count = trend.revenueEstimate?.numberOfAnalysts?.raw ?? null;

      const market_cap = data.price?.marketCap?.raw ?? null;
      const analyst_target_price = fin.targetMeanPrice?.raw ?? null;
      const analyst_recommendation = fin.recommendationKey || null;
      const profit_margin = fin.profitMargins?.raw ?? null;
      const pe_ratio = stats.forwardPE?.raw ?? stats.trailingPE?.raw ?? null;

      const analyst_strong_buy = recTrend.strongBuy ?? null;
      const analyst_buy = recTrend.buy ?? null;
      const analyst_hold = recTrend.hold ?? null;
      const analyst_sell = recTrend.sell ?? null;
      const analyst_strong_sell = recTrend.strongSell ?? null;

      // Only proceed if we got at least some useful data
      if (!revenue_estimate && !market_cap && !analyst_target_price) return;

      // Update all upcoming rows for this ticker
      const tickerRows = rows.filter(r => r.ticker === ticker);
      for (const row of tickerRows) {
        const reportDate = row.report_date instanceof Date
          ? row.report_date.toISOString().split('T')[0]
          : String(row.report_date).split('T')[0];
        await upsertEarning({
          ticker, report_date: reportDate,
          revenue_estimate, revenue_estimate_low, revenue_estimate_high,
          eps_estimate_low, eps_estimate_high,
          analyst_count, market_cap,
          analyst_strong_buy, analyst_buy, analyst_hold, analyst_sell, analyst_strong_sell,
          analyst_target_price, analyst_recommendation,
          pe_ratio, profit_margin,
          status: 'upcoming', source: null,
        }).catch(() => {});
      }
      enriched++;
    }));
    if (i + 5 < uniqueTickers.length) await sleep(1200);
  }

  console.log(`[earnings enrich] Done: ${enriched}/${uniqueTickers.length} tickers enriched`);
  return enriched;
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
    let total = 0;
    const nasdaqCount = await scrapeNasdaqWeek().catch(e => { console.error('[earnings] NASDAQ failed:', e.message); return 0; });
    total += nasdaqCount;

    const tickers = await getTickersToScrape();
    console.log(`[earnings] Yahoo scraping ${tickers.length} tickers for history`);
    for (let i = 0; i < tickers.length; i += 5) {
      const batch = tickers.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map(({ ticker, company }) => processTicker(ticker, company)));
      for (const r of results) if (r.status === 'fulfilled') total += r.value;
      if (i + 5 < tickers.length) await sleep(1200);
    }

    // Enrich after all ticker saves so market_cap/analyst data fills in correctly
    await enrichEarningsFromYahoo().catch(e => console.error('[earnings] Enrichment failed:', e.message));

    await seedIfEmpty();
    console.log(`[earnings] Total saved: ${total}`);
    return { count: total };
  } finally {
    await cache.del('earnings:scraping').catch(() => {});
  }
}

module.exports = { runEarningsScraper, enrichEarningsFromYahoo, seedIfEmpty };
