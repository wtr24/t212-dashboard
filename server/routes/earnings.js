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

// AI diagnostic: list available models + test specific model
router.get('/ai-test', async (req, res) => {
  const https = require('https');
  const key = process.env.GEMINI_API_KEY;

  function httpsGet(path) {
    return new Promise((resolve, reject) => {
      https.get({ hostname: 'generativelanguage.googleapis.com', path, timeout: 10000 }, r => {
        let d = ''; r.on('data', c => { d += c; }); r.on('end', () => resolve({ status: r.statusCode, body: d.slice(0, 600) }));
      }).on('error', reject);
    });
  }

  function httpsPost(path, body) {
    return new Promise((resolve, reject) => {
      const buf = Buffer.from(body);
      const req = https.request({ hostname: 'generativelanguage.googleapis.com', path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }, timeout: 15000 }, r => {
        let d = ''; r.on('data', c => { d += c; }); r.on('end', () => resolve({ status: r.statusCode, body: d.slice(0, 400) }));
      });
      req.on('error', reject); req.write(buf); req.end();
    });
  }

  try {
    const keyLen = key?.length || 0;
    const prompt = JSON.stringify({ contents: [{ parts: [{ text: 'Say: OK' }] }], generationConfig: { maxOutputTokens: 10 } });

    const [listV1beta, listV1, flash15, flash15v1, flashLite, geminiPro] = await Promise.all([
      httpsGet(`/v1beta/models?key=${key}`),
      httpsGet(`/v1/models?key=${key}`),
      httpsPost(`/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, prompt),
      httpsPost(`/v1/models/gemini-1.5-flash:generateContent?key=${key}`, prompt),
      httpsPost(`/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`, prompt),
      httpsPost(`/v1beta/models/gemini-pro:generateContent?key=${key}`, prompt),
    ]);

    const parseNames = (r) => {
      try { const j = JSON.parse(r.body); return (j.models || []).map(m => m.name).filter(n => n.includes('flash') || n.includes('pro') || n.includes('gemini')).slice(0, 10); } catch { return []; }
    };

    res.json({
      keyLen,
      models_v1beta: { status: listV1beta.status, names: parseNames(listV1beta) },
      models_v1: { status: listV1.status, names: parseNames(listV1) },
      tests: {
        'v1beta/gemini-1.5-flash': { status: flash15.status, body: flash15.body.slice(0, 100) },
        'v1/gemini-1.5-flash': { status: flash15v1.status, body: flash15v1.body.slice(0, 100) },
        'v1beta/gemini-1.5-flash-latest': { status: flashLite.status, body: flashLite.body.slice(0, 100) },
        'v1beta/gemini-pro': { status: geminiPro.status, body: geminiPro.body.slice(0, 100) },
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI routes
router.get('/ai-status', async (req, res) => {
  try {
    const { getIsRunning } = require('../jobs/earningsAiJob');
    const r = await query(
      `SELECT key, value FROM app_settings WHERE key IN ('earnings_ai_last_run','earnings_ai_last_run_count','earnings_ai_run_time','earnings_ai_enabled')`
    ).catch(() => ({ rows: [] }));
    const settings = {};
    for (const row of r.rows) settings[row.key] = row.value;
    res.json({
      isRunning: getIsRunning(),
      lastRun: settings.earnings_ai_last_run || null,
      lastRunCount: parseInt(settings.earnings_ai_last_run_count) || 0,
      runTime: settings.earnings_ai_run_time || '07:00',
      enabled: settings.earnings_ai_enabled !== 'false',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/ai-run', async (req, res) => {
  try {
    const { runEarningsAiAnalysis, getIsRunning } = require('../jobs/earningsAiJob');
    if (getIsRunning()) return res.json({ triggered: false, reason: 'already_running' });
    runEarningsAiAnalysis(true).catch(e => console.error('[earnings ai-run]', e.message));
    res.json({ triggered: true });
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
