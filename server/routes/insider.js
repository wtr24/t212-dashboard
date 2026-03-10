const express = require('express');
const router = express.Router();
const svc = require('../services/insiderService');
const cache = require('../services/cache');

router.get('/trades', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await svc.getRecentTrades(req.query));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await svc.getStats());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/insiders', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(await svc.getInsiders());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tickers', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(await svc.getTickers());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/insider/:name', async (req, res) => {
  try { res.json(await svc.getInsiderProfile(req.params.name)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scrape-status', async (req, res) => {
  try {
    const [lastRun, isRunning, scraperRows] = await Promise.all([
      cache.get('insider:last_run'),
      cache.get('insider:scraping'),
      svc.getScraperStatus(),
    ]);
    const lastRunMs = lastRun ? parseInt(lastRun) : null;
    const nextRunIn = lastRunMs ? Math.max(0, Math.ceil((lastRunMs + 5 * 60 * 1000 - Date.now()) / 1000)) : 0;
    res.json({
      is_running: !!isRunning,
      last_run: lastRunMs ? new Date(lastRunMs).toISOString() : null,
      last_run_ago_seconds: lastRunMs ? Math.floor((Date.now() - lastRunMs) / 1000) : null,
      next_run_in_seconds: nextRunIn,
      sources: scraperRows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scrape', async (req, res) => {
  try {
    const { triggerScrape } = require('../jobs/insiderScraper');
    const isRunning = await cache.get('insider:scraping').catch(() => null);
    if (isRunning) return res.json({ status: 'already_running' });
    triggerScrape().then(() => svc.invalidateCache()).catch(e => console.error('[insider manual]', e.message));
    res.json({ status: 'started', message: 'Scraping started — check /scrape-status in 30s' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
