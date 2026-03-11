const express = require('express');
const router = express.Router();
const svc = require('../services/earningsService');
const cache = require('../services/cache');

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

router.get('/:ticker', async (req, res) => {
  try {
    const data = await svc.getHistoricalEarnings(req.params.ticker);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
