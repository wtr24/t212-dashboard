const express = require('express');
const router = express.Router();
const svc = require('../services/congressService');
const cache = require('../services/cache');

router.get('/trades', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await svc.getRecentTrades(req.query));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/trades/:id', async (req, res) => {
  try {
    const { query } = require('../models/db');
    const r = await query('SELECT * FROM congress_trades WHERE id=$1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(await svc.getStats());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/members', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(await svc.getMembers());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tickers', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(await svc.getTickers());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pelosi', async (req, res) => {
  try { res.json(await svc.getMemberTrades('Pelosi')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/member/:name', async (req, res) => {
  try { res.json(await svc.getMemberTrades(req.params.name)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scrape-status', async (req, res) => {
  try {
    const [lastRun, isRunning, scraperRows] = await Promise.all([
      cache.get('congress:last_run'),
      cache.get('congress:scraping'),
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
    const { triggerScrape } = require('../jobs/congressScraper');
    const isRunning = await cache.get('congress:scraping').catch(() => null);
    if (isRunning) return res.json({ status: 'already_running' });
    triggerScrape().then(() => svc.invalidateCache()).catch(e => console.error('[congress manual]', e.message));
    res.json({ status: 'started', message: 'Scraping started — check /scrape-status in 30s' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
