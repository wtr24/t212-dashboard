const express = require('express');
const router = express.Router();
const { analyseStock, analysePortfolio, getFromDB, isFresh } = require('../services/technicalAnalysis');
const { query } = require('../models/db');
const t212 = require('../services/t212');

function cleanTicker(raw) {
  return (raw || '').replace(/[_](US|UK|EQ|NASDAQ|NYSE|LSE|ALL)[_A-Z0-9]*/g, '').split('_')[0] || raw;
}

async function getPortfolioTickers() {
  const result = await t212.getPortfolio().catch(() => ({ data: [] }));
  const positions = result.data || [];
  return [...new Set(positions.map(p => cleanTicker(p.ticker)).filter(Boolean))];
}

// GET /api/technical/portfolio - all portfolio tickers (cached if fresh)
router.get('/portfolio', async (req, res) => {
  try {
    const tickers = await getPortfolioTickers();
    if (!tickers.length) return res.json([]);
    const rows = await Promise.all(tickers.map(t => getFromDB(t)));
    const result = rows.filter(Boolean).sort((a, b) => (b.technical_score || 0) - (a.technical_score || 0));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/technical/screener - filter by params
router.get('/screener', async (req, res) => {
  try {
    const { signal, minScore, maxScore, maxRsi, minRsi, trend } = req.query;
    let sql = 'SELECT * FROM technical_analysis WHERE 1=1';
    const params = [];
    if (signal) { params.push(signal); sql += ` AND technical_signal=$${params.length}`; }
    if (minScore) { params.push(parseInt(minScore)); sql += ` AND technical_score>=$${params.length}`; }
    if (maxScore) { params.push(parseInt(maxScore)); sql += ` AND technical_score<=$${params.length}`; }
    if (maxRsi) { params.push(parseFloat(maxRsi)); sql += ` AND rsi_14<=$${params.length}`; }
    if (minRsi) { params.push(parseFloat(minRsi)); sql += ` AND rsi_14>=$${params.length}`; }
    if (trend) { params.push(trend); sql += ` AND trend=$${params.length}`; }
    sql += ' ORDER BY technical_score DESC LIMIT 50';
    const { rows } = await query(sql, params).catch(() => ({ rows: [] }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/technical/refresh-all - refresh all portfolio tickers in background
router.post('/refresh-all', async (req, res) => {
  try {
    const tickers = await getPortfolioTickers();
    res.json({ triggered: true, count: tickers.length, estimatedSeconds: tickers.length * 0.5 });
    analysePortfolio(tickers).catch(e => console.error('[TA] refresh-all failed:', e.message));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/technical/refresh/:ticker - force refresh single ticker
router.post('/refresh/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const result = await analyseStock(ticker);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/technical/:ticker - get TA (from DB if fresh, else analyse)
router.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const fresh = await isFresh(ticker, 60);
    if (fresh) {
      const cached = await getFromDB(ticker);
      return res.json({ ...cached, fromCache: true });
    }
    const result = await analyseStock(ticker);
    if (result.error) {
      const stale = await getFromDB(ticker);
      if (stale) return res.json({ ...stale, fromCache: true, stale: true });
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
