const cron = require('node-cron');
const { query } = require('../models/db');
const { analyzeEarning, GEMINI_MODEL } = require('../services/geminiEarnings');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let isRunning = false;
let currentCronJob = null;

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

async function getNextBusinessDate() {
  const r = await query(
    `SELECT DISTINCT report_date FROM earnings_calendar WHERE report_date > CURRENT_DATE AND status='upcoming' ORDER BY report_date LIMIT 1`
  ).catch(() => ({ rows: [] }));
  return r.rows[0]?.report_date || null;
}

async function runEarningsAiAnalysis(force = false) {
  if (isRunning) { console.log('[earnings ai] Already running'); return { skipped: true }; }

  if (!force) {
    const lastRun = await getSetting('earnings_ai_last_run');
    const today = new Date().toISOString().split('T')[0];
    if (lastRun === today) { console.log('[earnings ai] Already ran today, skipping'); return { skipped: true, reason: 'already_ran_today' }; }
  }

  isRunning = true;
  const started = new Date();
  let analysed = 0; let failed = 0; const tickers = [];

  try {
    const today = new Date().toISOString().split('T')[0];
    let { rows } = await query(
      `SELECT * FROM earnings_calendar WHERE report_date=$1 AND status='upcoming' ORDER BY ai_confidence DESC NULLS LAST LIMIT 30`,
      [today]
    ).catch(() => ({ rows: [] }));

    if (!rows.length) {
      const nextDate = await getNextBusinessDate();
      if (nextDate) {
        const r = await query(
          `SELECT * FROM earnings_calendar WHERE report_date=$1 AND status='upcoming' ORDER BY ticker LIMIT 30`,
          [nextDate]
        ).catch(() => ({ rows: [] }));
        rows = r.rows;
        console.log(`[earnings ai] No earnings today, using next date: ${nextDate} (${rows.length} records)`);
      }
    }

    if (!rows.length) { console.log('[earnings ai] No earnings to analyse'); isRunning = false; return { analysed: 0, failed: 0 }; }

    console.log(`[earnings ai] Starting analysis for ${rows.length} earnings`);

    for (let i = 0; i < rows.length; i++) {
      const e = rows[i];
      const reportDateStr = e.report_date instanceof Date ? e.report_date.toISOString().split('T')[0] : String(e.report_date).split('T')[0];

      console.log(`[earnings ai] Analysing ${e.ticker} (${i + 1}/${rows.length})`);

      const result = await analyzeEarning({
        ticker: e.ticker, company: e.company, reportDate: reportDateStr,
        reportTime: e.report_time, epsEstimate: parseFloat(e.eps_estimate) || null,
        revenueEstimate: e.revenue_estimate, fiscalQuarter: e.fiscal_quarter,
        beatRateLast4: 0, avgSurprisePct: 0,
      });

      if (result.error) { failed++; }
      else {
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
        ).catch(err => console.error(`[earnings ai] DB update failed for ${e.ticker}:`, err.message));
        analysed++;
        tickers.push(e.ticker);
      }

      if (i < rows.length - 1) await sleep(2000);
    }

    await setSetting('earnings_ai_last_run', new Date().toISOString().split('T')[0]);
    await setSetting('earnings_ai_last_run_count', String(analysed));

    const duration = Math.round((Date.now() - started) / 1000);
    console.log(`[earnings ai] Done: ${analysed} analysed, ${failed} failed in ${duration}s`);
    return { analysed, failed, tickers, ranAt: started.toISOString(), durationSecs: duration };
  } finally {
    isRunning = false;
  }
}

async function scheduleEarningsAiJob() {
  const runTime = await getSetting('earnings_ai_run_time') || '07:00';
  const [hour, minute] = runTime.split(':').map(Number);
  const cronExpr = `${minute || 0} ${hour || 7} * * *`;

  if (currentCronJob) currentCronJob.stop();

  currentCronJob = cron.schedule(cronExpr, async () => {
    const enabled = await getSetting('earnings_ai_enabled');
    if (enabled === 'false') { console.log('[earnings ai] Disabled, skipping scheduled run'); return; }
    console.log(`[earnings ai] Scheduled run triggered at ${runTime}`);
    runEarningsAiAnalysis(false).catch(e => console.error('[earnings ai] Scheduled run failed:', e.message));
  });

  console.log(`[earnings ai] Scheduled daily at ${runTime} (cron: ${cronExpr})`);
}

function getIsRunning() { return isRunning; }

module.exports = { runEarningsAiAnalysis, scheduleEarningsAiJob, getIsRunning };
