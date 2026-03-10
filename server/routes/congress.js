const express = require('express');
const router = express.Router();
const svc = require('../services/congressService');

router.get('/trades', async (req, res) => {
  try {
    const result = await svc.getRecentTrades(req.query);
    res.json(result);
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
  try { res.json(await svc.getStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/members', async (req, res) => {
  try { res.json(await svc.getMembers()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tickers', async (req, res) => {
  try { res.json(await svc.getTickers()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pelosi', async (req, res) => {
  try { res.json(await svc.getMemberTrades('Pelosi')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/member/:name', async (req, res) => {
  try { res.json(await svc.getMemberTrades(req.params.name)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scraper-status', async (req, res) => {
  try { res.json(await svc.getScraperStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/refresh', async (req, res) => {
  try {
    const { runAllScrapers } = require('../jobs/congressScraper');
    const result = await runAllScrapers();
    await svc.invalidateCache();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
