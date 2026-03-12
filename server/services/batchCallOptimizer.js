const axios = require('axios');
const cache = require('./cache');
const { withRateLimit } = require('./rateLimitManager');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36';

const YAHOO_MODULES = [
  'price', 'summaryDetail', 'defaultKeyStatistics', 'financialData',
  'earningsTrend', 'calendarEvents', 'recommendationTrend',
  'upgradeDowngradeHistory', 'earnings', 'assetProfile',
  'incomeStatementHistoryQuarterly',
].join(',');

async function fetchYahooComplete(ticker) {
  const cacheKey = 'yf_complete_' + ticker;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${YAHOO_MODULES}`;
  const { data } = await withRateLimit('yahoofinance', () =>
    axios.get(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, timeout: 15000 })
  );
  const result = data?.quoteSummary?.result?.[0];
  if (!result) throw new Error(`No data for ${ticker}`);
  await cache.setEx(cacheKey, 14400, JSON.stringify(result));
  return result;
}

function extractPrice(r) {
  const p = r.price || {};
  return {
    price: p.regularMarketPrice?.raw ?? p.regularMarketPrice,
    change: p.regularMarketChange?.raw,
    changePercent: p.regularMarketChangePercent?.raw,
    volume: p.regularMarketVolume?.raw,
    mktCap: p.marketCap?.raw,
    open: p.regularMarketOpen?.raw,
    dayHigh: p.regularMarketDayHigh?.raw,
    dayLow: p.regularMarketDayLow?.raw,
    prevClose: p.regularMarketPreviousClose?.raw,
  };
}

function extractTechnicalInputs(r) {
  const s = r.summaryDetail || {};
  return {
    week52High: s.fiftyTwoWeekHigh?.raw,
    week52Low: s.fiftyTwoWeekLow?.raw,
    avgVolume20d: s.averageVolume?.raw,
    beta: s.beta?.raw,
    pe: s.trailingPE?.raw,
  };
}

function extractEarningsEstimates(r) {
  const trend = r.earningsTrend?.trend?.[0] || {};
  return {
    epsEstimate: trend.earningsEstimate?.avg?.raw ?? null,
    epsEstimateLow: trend.earningsEstimate?.low?.raw ?? null,
    epsEstimateHigh: trend.earningsEstimate?.high?.raw ?? null,
    revenueEstimate: trend.revenueEstimate?.avg?.raw ?? null,
    revenueEstimateLow: trend.revenueEstimate?.low?.raw ?? null,
    revenueEstimateHigh: trend.revenueEstimate?.high?.raw ?? null,
    analystCount: trend.earningsEstimate?.numberOfAnalysts?.raw ?? null,
    growthEstimate: trend.earningsEstimate?.growth?.raw ?? null,
    revenueGrowth: trend.revenueEstimate?.growth?.raw ?? null,
  };
}

function extractEarningsHistory(r) {
  const quarterly = r.earnings?.earningsChart?.quarterly || [];
  return quarterly.map(q => ({
    quarter: q.date,
    epsEstimate: q.estimate?.raw,
    epsActual: q.actual?.raw,
    epsSurprise: q.actual?.raw != null && q.estimate?.raw != null ? q.actual.raw - q.estimate.raw : null,
    epsSurprisePct: q.actual?.raw != null && q.estimate?.raw != null
      ? ((q.actual.raw - q.estimate.raw) / Math.abs(q.estimate.raw)) * 100 : null,
  }));
}

function extractRevenueHistory(r) {
  const stmts = r.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
  return stmts.map(s => ({
    date: s.endDate?.fmt,
    totalRevenue: s.totalRevenue?.raw,
    grossProfit: s.grossProfit?.raw,
    netIncome: s.netIncome?.raw,
  }));
}

function extractAnalystData(r) {
  const fd = r.financialData || {};
  const rt = r.recommendationTrend?.trend?.[0] || {};
  const upgrades = (r.upgradeDowngradeHistory?.history || []).slice(0, 5);
  return {
    targetPrice: fd.targetMeanPrice?.raw,
    targetHigh: fd.targetHighPrice?.raw,
    targetLow: fd.targetLowPrice?.raw,
    recommendation: fd.recommendationKey,
    strongBuy: rt.strongBuy,
    buy: rt.buy,
    hold: rt.hold,
    sell: rt.sell,
    strongSell: rt.strongSell,
    recentUpgrades: upgrades.map(u => ({
      firm: u.firm, fromGrade: u.fromGrade, toGrade: u.toGrade, date: u.epochGradeDate,
    })),
  };
}

function extractAll(ticker, r) {
  return {
    ticker,
    fetchedAt: new Date(),
    price: extractPrice(r),
    technical: extractTechnicalInputs(r),
    estimates: extractEarningsEstimates(r),
    earningsHistory: extractEarningsHistory(r),
    revenueHistory: extractRevenueHistory(r),
    analyst: extractAnalystData(r),
    nextEarningsDate: r.calendarEvents?.earnings?.earningsDate?.[0]?.raw,
    sector: r.assetProfile?.sector,
    industry: r.assetProfile?.industry,
  };
}

async function getFullStockData(ticker) {
  const raw = await fetchYahooComplete(ticker);
  return extractAll(ticker, raw);
}

async function getBulkStockData(tickers, options = {}) {
  const results = {};
  const batchSize = options.batchSize || 5;
  const delayMs = options.delayMs || 500;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(t => getFullStockData(t)));
    batchResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') results[batch[idx]] = r.value;
      else console.log('[bco] FAIL:', batch[idx], r.reason?.message);
    });
    if (i + batchSize < tickers.length) await sleep(delayMs);
  }
  return results;
}

async function getAlphaVantageComplete(ticker) {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) return null;
  const cacheKey = 'av_complete_' + ticker;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }
  const { withRateLimit: rl } = require('./rateLimitManager');
  const { data } = await rl('alphavantage', () =>
    axios.get(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${key}`, { timeout: 15000 })
  );
  if (!data.Symbol) return null;
  await cache.setEx(cacheKey, 86400, JSON.stringify(data));
  return data;
}

async function getFmpEarningsWeek() {
  const key = process.env.FMP_KEY;
  if (!key) return [];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.toISOString().split('T')[0];
  const cacheKey = 'fmp_earnings_week_' + fmt(monday);
  const cached = await cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }
  const { withRateLimit: rl } = require('./rateLimitManager');
  const { data } = await rl('fmp', () =>
    axios.get(
      `https://financialmodelingprep.com/api/v3/earning_calendar?from=${fmt(monday)}&to=${fmt(sunday)}&apikey=${key}`,
      { timeout: 12000 }
    )
  );
  const result = Array.isArray(data) ? data : [];
  await cache.setEx(cacheKey, 21600, JSON.stringify(result));
  return result;
}

module.exports = { getFullStockData, getBulkStockData, getAlphaVantageComplete, getFmpEarningsWeek, fetchYahooComplete, extractAll };
