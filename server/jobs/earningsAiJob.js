const cron = require('node-cron');
const { query } = require('../models/db');
const { analyzeEarning, GEMINI_MODEL, FREE_RPD, RPM_DELAY_MS, getRemainingQuota, getUsedToday } = require('../services/geminiEarnings');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let isRunning = false;
const cronJobs = [];

async function getSetting(key) {
  const r = await query('SELECT value FROM app_settings WHERE key=$1', [key]).catch(() => ({ rows: [] }));
  return r.rows[0]?.value || null;
}

async function setSetting(key, value) {
  await query(
    `INSERT INTO app_settings (key,value,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$2,updated_at=NOW()`,
    [key, value]
  ).catch(() => {});
}

// ── Priority scoring ──────────────────────────────────────────────────────────
// Higher score = analyse first

async function getPrioritizedEarnings(date, limit) {
  // Get portfolio tickers for bonus scoring
  const portRes = await query('SELECT ticker FROM positions').catch(() => ({ rows: [] }));
  const portfolioTickers = new Set(portRes.rows.map(r => r.ticker));

  const { rows } = await query(
    `SELECT * FROM earnings_calendar
     WHERE report_date=$1 AND status='upcoming' AND ai_signal IS NULL
     ORDER BY ticker`,
    [date]
  ).catch(() => ({ rows: [] }));

  const scored = rows.map(e => {
    let score = 0;
    if (portfolioTickers.has(e.ticker)) score += 100;
    if (e.report_time === 'BMO' || e.report_time === 'Pre-Mkt') score += 10;
    if (e.eps_estimate != null) score += 15;
    if (e.revenue_estimate != null) score += 5;
    if ((e.analyst_count || 0) >= 5) score += 10;
    if ((e.analyst_count || 0) >= 15) score += 10;
    return { ...e, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit);
}

// ── Clean stale error records before any run ──────────────────────────────────

async function cleanErrorRecords() {
  await query(
    `UPDATE earnings_calendar
     SET ai_signal=NULL, ai_confidence=NULL, ai_beat_probability=NULL,
         ai_summary=NULL, ai_sentiment=NULL, ai_news_sentiment=NULL,
         ai_analyst_trend=NULL, ai_key_factors=NULL, ai_risks=NULL,
         ai_generated_at=NULL, ai_model=NULL
     WHERE ai_summary ILIKE '%request failed%'
        OR ai_summary ILIKE '%unavailable%'
        OR ai_summary ILIKE '%404%'
        OR ai_summary ILIKE '%quota%'
        OR ai_summary ILIKE '%429%'`
  ).catch(() => {});
}

// ── Core analysis runner ──────────────────────────────────────────────────────

async function runBatch(rows, label) {
  let analysed = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const remaining = await getRemainingQuota();
    if (remaining <= 0) {
      console.log(`[earnings ai] ${label}: quota exhausted after ${analysed} analyses`);
      break;
    }

    const e = rows[i];
    const reportDateStr = e.report_date instanceof Date
      ? e.report_date.toISOString().split('T')[0]
      : String(e.report_date).split('T')[0];

    console.log(`[earnings ai] ${label} ${e.ticker} (${i + 1}/${rows.length}) quota=${remaining}`);

    const result = await analyzeEarning({
      ticker: e.ticker, company: e.company, reportDate: reportDateStr,
      reportTime: e.report_time, epsEstimate: parseFloat(e.eps_estimate) || null,
      revenueEstimate: e.revenue_estimate ? parseInt(e.revenue_estimate) : null,
      fiscalQuarter: e.fiscal_quarter,
      marketCap: e.market_cap ? parseInt(e.market_cap) : null,
      analystRecommendation: e.analyst_recommendation || null,
      analystTargetPrice: e.analyst_target_price ? parseFloat(e.analyst_target_price) : null,
      analystBuy: e.analyst_buy != null ? parseInt(e.analyst_buy) : null,
      analystHold: e.analyst_hold != null ? parseInt(e.analyst_hold) : null,
      analystSell: e.analyst_sell != null ? parseInt(e.analyst_sell) : null,
      beatRateLast4: 0, avgSurprisePct: 0,
    });

    if (result.error) {
      if (result.error === 'daily_quota_exhausted') break;
      failed++;
    } else {
      await query(
        `UPDATE earnings_calendar SET
           ai_signal=$1, ai_confidence=$2, ai_beat_probability=$3, ai_summary=$4,
           ai_sentiment=$5, ai_news_sentiment=$6, ai_analyst_trend=$7,
           ai_key_factors=$8, ai_risks=$9, ai_generated_at=NOW(), ai_model=$10
         WHERE ticker=$11 AND report_date=$12`,
        [result.signal, result.confidence, result.beatProbability, result.summary,
         result.sentiment, result.newsSentiment, result.analystTrend,
         JSON.stringify(result.keyFactors), JSON.stringify(result.risks), GEMINI_MODEL,
         e.ticker, e.report_date]
      ).catch(err => console.error(`[earnings ai] DB update failed ${e.ticker}:`, err.message));
      analysed++;
    }

    if (i < rows.length - 1) await sleep(RPM_DELAY_MS);
  }

  return { analysed, failed };
}

// ── Wave 1: Portfolio stocks (06:30) ─────────────────────────────────────────

async function runWave1() {
  const enabled = await getSetting('earnings_ai_enabled');
  if (enabled === 'false') return;
  if (isRunning) return;
  isRunning = true;
  console.log('[earnings ai] Wave 1: portfolio stocks');
  await cleanErrorRecords();
  try {
    const today = new Date().toISOString().split('T')[0];
    const portRes = await query('SELECT ticker FROM positions').catch(() => ({ rows: [] }));
    const portfolioTickers = portRes.rows.map(r => r.ticker);
    if (!portfolioTickers.length) { isRunning = false; return; }

    const { rows } = await query(
      `SELECT * FROM earnings_calendar
       WHERE report_date=$1 AND status='upcoming' AND ai_signal IS NULL
         AND ticker = ANY($2)
       ORDER BY ticker`,
      [today, portfolioTickers]
    ).catch(() => ({ rows: [] }));

    if (!rows.length) { console.log('[earnings ai] Wave 1: no portfolio earnings today'); isRunning = false; return; }
    const { analysed } = await runBatch(rows, 'Wave1');
    await setSetting('earnings_ai_last_run', today);
    await setSetting('earnings_ai_last_run_count', String(analysed));
    console.log(`[earnings ai] Wave 1 done: ${analysed} analysed`);
  } finally { isRunning = false; }
}

// ── Wave 2: Top BMO by priority (07:00) ──────────────────────────────────────

async function runWave2() {
  const enabled = await getSetting('earnings_ai_enabled');
  if (enabled === 'false') return;
  if (isRunning) { console.log('[earnings ai] Wave 2 skipped: already running'); return; }
  isRunning = true;
  console.log('[earnings ai] Wave 2: top BMO earnings');
  await cleanErrorRecords();
  try {
    const today = new Date().toISOString().split('T')[0];
    const remaining = await getRemainingQuota();
    if (remaining <= 0) { console.log('[earnings ai] Wave 2: quota exhausted'); isRunning = false; return; }

    const rows = await getPrioritizedEarnings(today, Math.min(remaining, 10));
    const bmo = rows.filter(e => ['BMO', 'Pre-Mkt'].includes(e.report_time)).slice(0, Math.min(remaining, 8));

    if (!bmo.length) { console.log('[earnings ai] Wave 2: no BMO earnings pending'); isRunning = false; return; }
    const { analysed } = await runBatch(bmo, 'Wave2');
    const prev = parseInt(await getSetting('earnings_ai_last_run_count') || '0');
    await setSetting('earnings_ai_last_run', today);
    await setSetting('earnings_ai_last_run_count', String(prev + analysed));
    console.log(`[earnings ai] Wave 2 done: ${analysed} analysed`);
  } finally { isRunning = false; }
}

// ── Wave 3: AMC / remaining quota (12:00) ────────────────────────────────────

async function runWave3() {
  const enabled = await getSetting('earnings_ai_enabled');
  if (enabled === 'false') return;
  if (isRunning) { console.log('[earnings ai] Wave 3 skipped: already running'); return; }
  isRunning = true;
  console.log('[earnings ai] Wave 3: remaining quota / AMC earnings');
  await cleanErrorRecords();
  try {
    const today = new Date().toISOString().split('T')[0];
    const remaining = await getRemainingQuota();
    if (remaining <= 0) { console.log('[earnings ai] Wave 3: quota exhausted'); isRunning = false; return; }

    const rows = await getPrioritizedEarnings(today, Math.min(remaining, 12));
    if (!rows.length) { console.log('[earnings ai] Wave 3: all earnings already analysed'); isRunning = false; return; }
    const { analysed } = await runBatch(rows, 'Wave3');
    const prev = parseInt(await getSetting('earnings_ai_last_run_count') || '0');
    await setSetting('earnings_ai_last_run', today);
    await setSetting('earnings_ai_last_run_count', String(prev + analysed));
    console.log(`[earnings ai] Wave 3 done: ${analysed} analysed`);
  } finally { isRunning = false; }
}

// ── Manual force run (from Settings or API) ───────────────────────────────────

async function runEarningsAiAnalysis(force = false) {
  if (isRunning) { console.log('[earnings ai] Already running'); return { skipped: true, reason: 'already_running' }; }

  const remaining = await getRemainingQuota();
  if (remaining <= 0 && !force) {
    return { skipped: true, reason: 'quota_exhausted', quotaRemaining: 0, resetAt: 'midnight UTC' };
  }

  isRunning = true;
  const started = new Date();
  await cleanErrorRecords();

  try {
    const today = new Date().toISOString().split('T')[0];
    const effectiveRemaining = await getRemainingQuota();
    const limit = Math.min(effectiveRemaining, 10);

    let rows = await getPrioritizedEarnings(today, limit);

    if (!rows.length) {
      // Try next business date if nothing today
      const nextRes = await query(
        `SELECT DISTINCT report_date FROM earnings_calendar WHERE report_date > CURRENT_DATE AND status='upcoming' ORDER BY report_date LIMIT 1`
      ).catch(() => ({ rows: [] }));
      const nextDate = nextRes.rows[0]?.report_date;
      if (nextDate) {
        const nextRows = await getPrioritizedEarnings(
          nextDate instanceof Date ? nextDate.toISOString().split('T')[0] : String(nextDate).split('T')[0],
          limit
        );
        rows = nextRows;
        console.log(`[earnings ai] No pending earnings today, using ${nextDate} (${rows.length} records)`);
      }
    }

    if (!rows.length) {
      console.log('[earnings ai] Nothing to analyse');
      isRunning = false;
      return { analysed: 0, failed: 0, quotaRemaining: effectiveRemaining };
    }

    console.log(`[earnings ai] Manual run: ${rows.length} earnings, quota=${effectiveRemaining}`);
    const { analysed, failed } = await runBatch(rows, 'Manual');

    const quotaAfter = await getRemainingQuota();
    await setSetting('earnings_ai_last_run', today);
    await setSetting('earnings_ai_last_run_count', String(analysed));

    const duration = Math.round((Date.now() - started) / 1000);
    console.log(`[earnings ai] Done: ${analysed} analysed, ${failed} failed in ${duration}s | quota left: ${quotaAfter}`);
    return { analysed, failed, quotaRemaining: quotaAfter, durationSecs: duration };
  } finally {
    isRunning = false;
  }
}

// ── Schedule all waves ────────────────────────────────────────────────────────

async function scheduleEarningsAiJob() {
  for (const j of cronJobs) j.stop();
  cronJobs.length = 0;

  const enabled = await getSetting('earnings_ai_enabled');
  if (enabled === 'false') {
    console.log('[earnings ai] Disabled, not scheduling');
    return;
  }

  cronJobs.push(cron.schedule('30 6 * * *', () => runWave1().catch(e => console.error('[earnings ai] Wave1 failed:', e.message))));
  cronJobs.push(cron.schedule('0 7 * * *',  () => runWave2().catch(e => console.error('[earnings ai] Wave2 failed:', e.message))));
  cronJobs.push(cron.schedule('0 12 * * *', () => runWave3().catch(e => console.error('[earnings ai] Wave3 failed:', e.message))));

  console.log('[earnings ai] Scheduled: Wave1=06:30, Wave2=07:00, Wave3=12:00 daily');
}

function getIsRunning() { return isRunning; }

module.exports = { runEarningsAiAnalysis, scheduleEarningsAiJob, getIsRunning };
