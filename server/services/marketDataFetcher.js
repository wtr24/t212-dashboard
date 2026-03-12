const axios = require('axios');
const { query } = require('../models/db');
const { withRateLimit, canCall } = require('./rateLimitManager');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36';

// ── Yahoo Finance helpers ──────────────────────────────────────────────────────

async function yahooFetch(url) {
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    timeout: 12000,
  });
  return data;
}

// ── OHLCV ─────────────────────────────────────────────────────────────────────

async function fetchOHLCVYahoo(ticker, days = 250) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
    const data = await withRateLimit('yahoofinance', () => yahooFetch(url));
    const res = data?.chart?.result?.[0];
    if (!res) return null;
    const ts = res.timestamp || [];
    const q = res.indicators?.quote?.[0] || {};
    const meta = res.meta || {};
    const candles = ts.map((t, i) => ({
      date: new Date(t * 1000),
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: q.close?.[i],
      volume: q.volume?.[i],
    })).filter(c => c.close != null && c.high != null && c.low != null && c.volume != null);
    return candles.length >= 20 ? { candles, meta, source: 'yahoo' } : null;
  } catch (e) {
    console.log(`[mdf] yahoo OHLCV ${ticker}: ${e.message}`);
    return null;
  }
}

async function fetchOHLCVTwelveData(ticker, days = 250) {
  const key = process.env.TWELVE_DATA_KEY;
  if (!key) return null;
  try {
    const ok = await canCall('twelvedata');
    if (!ok) return null;
    const { data } = await axios.get(
      `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=1day&outputsize=${days}&apikey=${key}`,
      { timeout: 15000 }
    );
    if (data.status === 'error' || !data.values) return null;
    const candles = data.values.reverse().map(r => ({
      date: new Date(r.datetime),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseInt(r.volume) || 0,
    })).filter(c => !isNaN(c.close));
    if (candles.length < 20) return null;
    const { recordCall } = require('./rateLimitManager');
    await recordCall('twelvedata');
    return { candles, meta: {}, source: 'twelvedata' };
  } catch (e) {
    console.log(`[mdf] twelvedata OHLCV ${ticker}: ${e.message}`);
    return null;
  }
}

async function fetchOHLCV(ticker, days = 250) {
  let result = await fetchOHLCVYahoo(ticker, days);
  if (result && result.candles.length >= 50) return result;
  console.log(`[mdf] ${ticker}: yahoo returned ${result?.candles?.length || 0} candles, trying twelvedata`);
  result = await fetchOHLCVTwelveData(ticker, days);
  if (result) return result;
  return result || { candles: [], meta: {}, source: 'none' };
}

// ── Live Quote ─────────────────────────────────────────────────────────────────

async function fetchLiveQuote(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
    const data = await withRateLimit('yahoofinance', () => yahooFetch(url));
    const meta = data?.chart?.result?.[0]?.meta || {};
    if (meta.regularMarketPrice) return { ...meta, source: 'yahoo' };
  } catch (e) {
    console.log(`[mdf] yahoo quote ${ticker}: ${e.message}`);
  }
  const key = process.env.TWELVE_DATA_KEY;
  if (key) {
    try {
      const ok = await canCall('twelvedata');
      if (ok) {
        const { data } = await axios.get(
          `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${key}`,
          { timeout: 10000 }
        );
        if (data.close && !data.status?.includes('error')) {
          const { recordCall } = require('./rateLimitManager');
          await recordCall('twelvedata');
          return {
            regularMarketPrice: parseFloat(data.close),
            regularMarketPreviousClose: parseFloat(data.previous_close),
            regularMarketOpen: parseFloat(data.open),
            regularMarketDayHigh: parseFloat(data.high),
            regularMarketDayLow: parseFloat(data.low),
            regularMarketVolume: parseInt(data.volume) || 0,
            source: 'twelvedata',
          };
        }
      }
    } catch (e) {
      console.log(`[mdf] twelvedata quote ${ticker}: ${e.message}`);
    }
  }
  const polyKey = process.env.POLYGON_KEY;
  if (polyKey) {
    try {
      const ok = await canCall('polygon');
      if (ok) {
        const { data } = await axios.get(
          `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apikey=${polyKey}`,
          { timeout: 10000 }
        );
        const r = data?.results?.[0];
        if (r) {
          const { recordCall } = require('./rateLimitManager');
          await recordCall('polygon');
          return {
            regularMarketPrice: r.c,
            regularMarketPreviousClose: r.o,
            regularMarketOpen: r.o,
            regularMarketDayHigh: r.h,
            regularMarketDayLow: r.l,
            regularMarketVolume: r.v,
            source: 'polygon',
          };
        }
      }
    } catch (e) {
      console.log(`[mdf] polygon quote ${ticker}: ${e.message}`);
    }
  }
  return null;
}

// ── Earnings Estimates ────────────────────────────────────────────────────────

async function fetchEarningsEstimatesYahoo(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=earningsTrend,financialData,recommendationTrend,defaultKeyStatistics,summaryDetail`;
    const data = await withRateLimit('yahoofinance', () => yahooFetch(url));
    const r = data?.quoteSummary?.result?.[0];
    if (!r) return null;
    const et = r.earningsTrend?.trend?.[0] || {};
    const fd = r.financialData || {};
    const sd = r.summaryDetail || {};
    const dks = r.defaultKeyStatistics || {};
    return {
      eps_estimate: et.earningsEstimate?.avg?.raw ?? null,
      eps_estimate_low: et.earningsEstimate?.low?.raw ?? null,
      eps_estimate_high: et.earningsEstimate?.high?.raw ?? null,
      revenue_estimate: et.revenueEstimate?.avg?.raw ?? null,
      revenue_estimate_low: et.revenueEstimate?.low?.raw ?? null,
      revenue_estimate_high: et.revenueEstimate?.high?.raw ?? null,
      analyst_count: et.earningsEstimate?.numberOfAnalysts?.raw ?? null,
      analyst_target_price: fd.targetMeanPrice?.raw ?? null,
      analyst_recommendation: fd.recommendationKey ?? null,
      analyst_buy: (r.recommendationTrend?.trend?.[0]?.strongBuy || 0) + (r.recommendationTrend?.trend?.[0]?.buy || 0),
      analyst_hold: r.recommendationTrend?.trend?.[0]?.hold ?? null,
      analyst_sell: (r.recommendationTrend?.trend?.[0]?.sell || 0) + (r.recommendationTrend?.trend?.[0]?.strongSell || 0),
      market_cap: sd.marketCap?.raw ?? dks.enterpriseValue?.raw ?? null,
      pe_ratio: sd.trailingPE?.raw ?? null,
      profit_margin: fd.profitMargins?.raw ?? null,
      source: 'yahoo',
    };
  } catch (e) {
    console.log(`[mdf] yahoo estimates ${ticker}: ${e.message}`);
    return null;
  }
}

async function fetchEarningsEstimatesFMP(ticker) {
  const key = process.env.FMP_KEY;
  if (!key) return null;
  try {
    const ok = await canCall('fmp');
    if (!ok) return null;
    const [estRes, profRes] = await Promise.allSettled([
      axios.get(`https://financialmodelingprep.com/api/v3/analyst-estimates/${ticker}?apikey=${key}&limit=2`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${key}`, { timeout: 10000 }),
    ]);
    const { recordCall } = require('./rateLimitManager');
    await recordCall('fmp');
    const est = estRes.status === 'fulfilled' ? estRes.value.data?.[0] : null;
    const prof = profRes.status === 'fulfilled' ? profRes.value.data?.[0] : null;
    if (!est && !prof) return null;
    return {
      eps_estimate: est?.estimatedEpsAvg ?? null,
      revenue_estimate: est?.estimatedRevenueAvg ?? null,
      analyst_count: est?.numberAnalystEstimatedRevenue ?? null,
      market_cap: prof?.mktCap ?? null,
      analyst_target_price: prof?.dcfDiff != null ? prof.price + prof.dcfDiff : null,
      analyst_recommendation: null,
      pe_ratio: prof?.pe ?? null,
      source: 'fmp',
    };
  } catch (e) {
    console.log(`[mdf] fmp estimates ${ticker}: ${e.message}`);
    return null;
  }
}

async function fetchEarningsEstimates(ticker) {
  const yahoo = await fetchEarningsEstimatesYahoo(ticker);
  const hasRevenue = yahoo?.revenue_estimate != null;
  const hasMarketCap = yahoo?.market_cap != null;
  if (hasRevenue && hasMarketCap) return yahoo;
  const fmp = await fetchEarningsEstimatesFMP(ticker);
  if (!yahoo && !fmp) return null;
  return {
    ...(fmp || {}),
    ...(yahoo || {}),
    revenue_estimate: yahoo?.revenue_estimate ?? fmp?.revenue_estimate ?? null,
    market_cap: yahoo?.market_cap ?? fmp?.market_cap ?? null,
    analyst_count: yahoo?.analyst_count ?? fmp?.analyst_count ?? null,
    analyst_target_price: yahoo?.analyst_target_price ?? fmp?.analyst_target_price ?? null,
    pe_ratio: yahoo?.pe_ratio ?? fmp?.pe_ratio ?? null,
    source: `yahoo+fmp`,
  };
}

// ── Enrich single earnings record ─────────────────────────────────────────────

async function enrichEarningsRecord(ticker, reportDate) {
  const estimates = await fetchEarningsEstimates(ticker);
  if (!estimates) return null;
  const updates = {};
  const fields = [
    'eps_estimate', 'eps_estimate_low', 'eps_estimate_high',
    'revenue_estimate', 'revenue_estimate_low', 'revenue_estimate_high',
    'analyst_count', 'analyst_target_price', 'analyst_recommendation',
    'analyst_buy', 'analyst_hold', 'analyst_sell',
    'market_cap', 'pe_ratio', 'profit_margin',
  ];
  for (const f of fields) {
    if (estimates[f] != null) updates[f] = estimates[f];
  }
  if (!Object.keys(updates).length) return null;
  const setClauses = Object.keys(updates).map((k, i) => `${k} = COALESCE($${i + 3}, ${k})`).join(', ');
  const vals = [ticker, reportDate || 'CURRENT_DATE', ...Object.values(updates)];
  await query(
    `UPDATE earnings_calendar SET ${setClauses}, updated_at = NOW()
     WHERE ticker = $1 AND report_date = ${reportDate ? '$2' : 'CURRENT_DATE'}`,
    vals
  ).catch(e => console.log(`[mdf] enrich DB ${ticker}: ${e.message}`));
  const rev = updates.revenue_estimate ? `$${(updates.revenue_estimate / 1e9).toFixed(1)}B` : '—';
  const mc = updates.market_cap ? `$${(updates.market_cap / 1e9).toFixed(0)}B` : '—';
  console.log(`[mdf] ENRICH ${ticker}: rev=${rev} mktcap=${mc} analysts=${updates.analyst_count || '—'} target=${updates.analyst_target_price || '—'}`);
  return updates;
}

// ── Batch enrich ──────────────────────────────────────────────────────────────

async function batchEnrichEarnings(tickers, reportDate = null, onlyMissing = true) {
  let toProcess = tickers;
  if (onlyMissing && reportDate) {
    const { rows } = await query(
      `SELECT ticker FROM earnings_calendar WHERE ticker = ANY($1) AND report_date = $2
       AND (revenue_estimate IS NULL OR market_cap IS NULL)`,
      [tickers, reportDate]
    ).catch(() => ({ rows: tickers.map(t => ({ ticker: t })) }));
    toProcess = rows.map(r => r.ticker);
  }
  let enriched = 0, failed = [];
  for (let i = 0; i < toProcess.length; i++) {
    const ticker = toProcess[i];
    console.log(`[mdf] ENRICHING ${i + 1}/${toProcess.length}: ${ticker}`);
    try {
      const r = await enrichEarningsRecord(ticker, reportDate);
      if (r) enriched++;
    } catch (e) {
      console.log(`[mdf] FAIL ${ticker}: ${e.message}`);
      failed.push(ticker);
    }
    if (i < toProcess.length - 1) await sleep(800);
  }
  return { enriched, skipped: tickers.length - toProcess.length, failed };
}

module.exports = {
  fetchOHLCV, fetchLiveQuote, fetchEarningsEstimates,
  enrichEarningsRecord, batchEnrichEarnings,
};
