const express = require('express');
const router = express.Router();
const svc = require('../services/stockService');

router.get('/quote/:ticker', async (req, res) => {
  try {
    const data = await svc.getStockQuote(req.params.ticker.toUpperCase());
    if (!data) return res.status(404).json({ error: 'Quote not found' });
    res.set('Cache-Control', 'public, max-age=60');
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history/:ticker', async (req, res) => {
  try {
    const range = req.query.range || '1mo';
    const data = await svc.getStockHistory(req.params.ticker.toUpperCase(), range);
    res.set('Cache-Control', 'public, max-age=300');
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/search', async (req, res) => {
  try {
    const results = await svc.searchStocks(req.query.q || '');
    res.set('Cache-Control', 'public, max-age=300');
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sp500', async (req, res) => {
  try {
    const list = await svc.getSP500List();
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
