const axios = require('axios');
const { updateActuals } = require('../services/earningsService');
const { query } = require('../models/db');
const cache = require('../services/cache');
const { withRateLimit, canCall } = require('../services/rateLimitManager');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36';

let lastPollAt = null;
let lastPollCount = 0;

function getLondonHour() {
  return new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false }).split(',')[0].trim().split(':')[0] !== undefined
    ? parseInt(new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false }))
    : new Date().getUTCHours() + 1;
}

function isMarketHours() {
  const d = new Date();
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const hour = getLondonHour();
  return hour >= 7 && hour <= 20;
}

async function fetchYahooActuals(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=earnings,incomeStatementHistoryQuarterly`;
    const { data } = await withRateLimit('yahoofinance', () =>
      axios.get(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, timeout: 12000 })
    );
    const r = data?.quoteSummary?.result?.[0];
    if (!r) return null;
    const quarterly = r.earnings?.earningsChart?.quarterly || [];
    const latest = quarterly[quarterly.length - 1];
    if (!latest?.actual?.raw) return null;
    const revenueActual = r.incomeStatementHistoryQuarterly?.incomeStatementHistory?.[0]?.totalRevenue?.raw || null;
    return {
      ticker,
      epsActual: latest.actual.raw,
      epsEstimate: latest.estimate?.raw,
      quarter: latest.date,
      revenueActual,
      source: 'yahoo',
    };
  } catch (e) {
    console.log(`[actuals] yahoo ${ticker}: ${e.message}`);
    return null;
  }
}

async function fetchFmpActuals(ticker) {
  const fmpKey = process.env.FMP_KEY;
  if (!fmpKey) return null;
  try {
    const ok = await canCall('fmp');
    if (!ok) return null;
    const { data } = await axios.get(
      `https://financialmodelingprep.com/api/v3/historical/earning_calendar/${ticker}?limit=1&apikey=${fmpKey}`,
      { timeout: 10000 }
    );
    const { recordCall } = require('../services/rateLimitManager');
    await recordCall('fmp');
    const recent = Array.isArray(data) ? data[0] : null;
    if (!recent?.eps) return null;
    return {
      ticker,
      epsActual: parseFloat(recent.eps),
      epsEstimate: parseFloat(recent.epsEstimated) || null,
      quarter: recent.date,
      revenueActual: recent.revenue ? parseFloat(recent.revenue) : null,
      revenueEstimate: recent.revenueEstimated ? parseFloat(recent.revenueEstimated) : null,
      source: 'fmp',
    };
  } catch (e) {
    console.log(`[actuals] fmp ${ticker}: ${e.message}`);
    return null;
  }
}

async function sendSurpriseAlert(row, result, surprisePct) {
  const webhookUrl = process.env.DISCORD_EARNINGS_WEBHOOK;
  if (!webhookUrl) return;
  try {
    const beat = surprisePct > 0;
    const emoji = surprisePct > 20 ? '🚀' : surprisePct > 5 ? '✅' : surprisePct < -20 ? '💥' : '❌';
    const color = beat ? 0x10b981 : 0xef4444;
    const fmtRev = v => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${v}`;
    const fields = [
      { name: 'EPS Actual', value: `$${result.epsActual.toFixed(2)}`, inline: true },
      { name: 'EPS Estimate', value: `$${(row.eps_estimate || 0).toFixed(2)}`, inline: true },
      { name: 'Surprise', value: `${beat ? '+' : ''}${surprisePct.toFixed(1)}%`, inline: true },
    ];
    if (result.revenueActual) {
      fields.push({ name: 'Revenue', value: fmtRev(result.revenueActual), inline: true });
    }
    await axios.post(webhookUrl, {
      embeds: [{
        color,
        title: `${emoji} EARNINGS RELEASED: ${row.ticker}`,
        description: `**${row.company || row.ticker}** ${beat ? '**BEAT**' : '**MISSED**'} estimates by **${Math.abs(surprisePct).toFixed(1)}%**`,
        fields,
        footer: { text: 'T212 Dashboard · Real-time earnings actuals' },
        timestamp: new Date().toISOString(),
      }],
    }, { timeout: 8000 });
    console.log(`[actuals] Discord alert sent: ${row.ticker} ${beat ? 'BEAT' : 'MISS'} ${surprisePct.toFixed(1)}%`);
  } catch (e) {
    console.log(`[actuals] Discord alert failed: ${e.message}`);
  }
}

async function pollEarningsActuals() {
  if (!isMarketHours()) return 0;

  const { rows } = await query(`
    SELECT ticker, eps_estimate, revenue_estimate, report_date, report_time, company
    FROM earnings_calendar
    WHERE report_date >= CURRENT_DATE - INTERVAL '1 day'
      AND report_date <= CURRENT_DATE
      AND eps_actual IS NULL
      AND eps_estimate IS NOT NULL
    ORDER BY
      CASE WHEN report_date = CURRENT_DATE THEN 0 ELSE 1 END,
      market_cap DESC NULLS LAST
    LIMIT 50
  `).catch(() => ({ rows: [] }));

  if (!rows.length) return 0;
  console.log(`[actuals] Polling ${rows.length} pending tickers`);
  lastPollAt = new Date();

  let updated = 0;
  for (const row of rows) {
    try {
      let result = await fetchYahooActuals(row.ticker);
      if (!result?.epsActual && row.eps_estimate) {
        result = await fetchFmpActuals(row.ticker);
      }
      if (!result?.epsActual) { await sleep(300); continue; }

      const est = row.eps_estimate;
      if (est) {
        const ratio = result.epsActual / est;
        if (ratio < 0.01 || ratio > 100) { await sleep(300); continue; }
      }

      const surprise = est ? result.epsActual - est : null;
      const surprisePct = est ? (surprise / Math.abs(est)) * 100 : null;

      await query(
        `UPDATE earnings_calendar SET
          eps_actual=$1, revenue_actual=$2, eps_surprise=$3, eps_surprise_pct=$4,
          status='reported', updated_at=NOW()
         WHERE ticker=$5 AND report_date=$6`,
        [result.epsActual, result.revenueActual, surprise, surprisePct, row.ticker, row.report_date]
      );

      await cache.del('earnings:today');
      await cache.del('earnings:week');
      await cache.del('yf_complete_' + row.ticker);

      console.log(`[actuals] ${row.ticker}: EPS=${result.epsActual} EST=${est} SURPRISE=${surprisePct?.toFixed(1)}% SRC=${result.source}`);
      updated++;
      lastPollCount = updated;

      if (surprisePct != null && Math.abs(surprisePct) > 10) {
        await sendSurpriseAlert(row, result, surprisePct);
      }
    } catch (e) {
      console.log(`[actuals] FAIL ${row.ticker}: ${e.message}`);
    }
    await sleep(350);
  }

  if (updated > 0) console.log(`[actuals] Poll complete: ${updated} actuals updated`);
  return updated;
}

// Legacy runActualsUpdater kept for backward compat (called by existing cron)
async function runActualsUpdater() {
  return pollEarningsActuals();
}

function getPollStatus() {
  return { lastPollAt, lastPollCount, isMarketHours: isMarketHours() };
}

module.exports = { runActualsUpdater, pollEarningsActuals, getPollStatus };
