const express = require('express');
const router = express.Router();
const svc = require('../services/earningsService');
const cache = require('../services/cache');
const { query } = require('../models/db');

router.get('/today', async (req, res) => {
  try {
    const cacheKey = 'earnings:today';
    const cached = await cache.get(cacheKey).catch(() => null);
    if (cached) return res.json(JSON.parse(cached));
    const data = await svc.getEarningsToday();
    await cache.setEx(cacheKey, 300, JSON.stringify(data)).catch(() => {});
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/week', async (req, res) => {
  try {
    const cacheKey = 'earnings:week';
    const cached = await cache.get(cacheKey).catch(() => null);
    if (cached) return res.json(JSON.parse(cached));
    const rows = await svc.getEarningsThisWeek();
    const byDay = {};
    for (const r of rows) {
      const d = r.report_date instanceof Date ? r.report_date.toISOString().split('T')[0] : String(r.report_date).split('T')[0];
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(r);
    }
    await cache.setEx(cacheKey, 300, JSON.stringify(byDay)).catch(() => {});
    res.json(byDay);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/month', async (req, res) => {
  try {
    const data = await svc.getEarningsThisMonth();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 8;
    const data = await svc.getPastEarnings(weeks);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/my-portfolio', async (req, res) => {
  try {
    const data = await svc.getMyPortfolioEarnings();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scrape-status', async (req, res) => {
  try {
    const status = await svc.getScraperStatus();
    const running = !!(await cache.get('earnings:scraping').catch(() => null));
    res.json({ ...status, running });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/refresh', async (req, res) => {
  try {
    const { runEarningsScraper } = require('../scrapers/earningsCalendar');
    await cache.del('earnings:today').catch(() => {});
    await cache.del('earnings:week').catch(() => {});
    runEarningsScraper().catch(e => console.error('[earnings refresh]', e.message));
    res.json({ triggered: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI diagnostic: test single stock analysis
router.get('/ai-test', async (req, res) => {
  try {
    const { analyzeEarning, GEMINI_MODEL } = require('../services/geminiEarnings');
    const ticker = (req.query.ticker || 'AAPL').toUpperCase();
    const keyExists = !!process.env.GEMINI_API_KEY;
    const keyLen = process.env.GEMINI_API_KEY?.length || 0;
    const result = await analyzeEarning({
      ticker, company: ticker + ' Corp', reportDate: new Date().toISOString().split('T')[0],
      epsEstimate: 1.50, fiscalQuarter: 'Q1 2026', beatRateLast4: 3, avgSurprisePct: 2.0,
    });
    res.json({ keyExists, keyLen, model: GEMINI_MODEL, result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI routes
router.get('/ai-status', async (req, res) => {
  try {
    const { getIsRunning } = require('../jobs/earningsAiJob');
    const { getRemainingQuota, getUsedToday, FREE_RPD, GEMINI_MODEL } = require('../services/geminiEarnings');
    const [settingsRes, remaining, used] = await Promise.all([
      query(`SELECT key, value FROM app_settings WHERE key IN ('earnings_ai_last_run','earnings_ai_last_run_count','earnings_ai_run_time','earnings_ai_enabled')`).catch(() => ({ rows: [] })),
      getRemainingQuota(),
      getUsedToday(),
    ]);
    const settings = {};
    for (const row of settingsRes.rows) settings[row.key] = row.value;
    const estimatedMins = ((remaining * (15 / 60))).toFixed(0);
    res.json({
      isRunning: getIsRunning(),
      lastRun: settings.earnings_ai_last_run || null,
      lastRunCount: parseInt(settings.earnings_ai_last_run_count) || 0,
      runTime: settings.earnings_ai_run_time || '07:00',
      enabled: settings.earnings_ai_enabled !== 'false',
      quotaUsedToday: used,
      quotaRemainingToday: remaining,
      quotaTotal: FREE_RPD,
      modelInUse: GEMINI_MODEL,
      estimatedMinsForRemaining: estimatedMins,
      waveSchedule: ['Wave 1 06:30 (portfolio)', 'Wave 2 07:00 (top BMO)', 'Wave 3 12:00 (remaining)'],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/ai-run', async (req, res) => {
  try {
    const { runEarningsAiAnalysis, getIsRunning } = require('../jobs/earningsAiJob');
    const { getRemainingQuota, FREE_RPD } = require('../services/geminiEarnings');
    if (getIsRunning()) return res.json({ triggered: false, reason: 'already_running' });
    const remaining = await getRemainingQuota();
    if (remaining <= 0) return res.json({ triggered: false, reason: 'quota_exhausted', quotaRemaining: 0, resetAt: 'midnight UTC' });
    runEarningsAiAnalysis(true).catch(e => console.error('[earnings ai-run]', e.message));
    res.json({ triggered: true, willAnalyse: remaining, quotaRemaining: remaining, estimatedMins: ((remaining * 15) / 60).toFixed(1) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/today-with-ai', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM earnings_calendar
       WHERE report_date = CURRENT_DATE
       ORDER BY ai_confidence DESC NULLS LAST, ticker ASC`
    ).catch(() => ({ rows: [] }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:ticker/ai-detail', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const [earningRes, newsRes] = await Promise.all([
      query(
        `SELECT * FROM earnings_calendar WHERE ticker=$1 ORDER BY report_date DESC LIMIT 1`,
        [ticker]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT * FROM earnings_ai_news WHERE ticker=$1 ORDER BY created_at DESC LIMIT 20`,
        [ticker]
      ).catch(() => ({ rows: [] })),
    ]);
    if (!earningRes.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ earning: earningRes.rows[0], news: newsRes.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:ticker', async (req, res) => {
  try {
    const data = await svc.getHistoricalEarnings(req.params.ticker);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
