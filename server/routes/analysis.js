const express = require('express');
const router = express.Router();
const t212 = require('../services/t212');
const { enrichPositions } = require('../services/marketData');
const { analysePosition, analyseTop10 } = require('../services/aiAnalysis');
const cache = require('../services/cache');

const DEMO_POSITIONS = [
  { ticker: 'AAPL', fullName: 'Apple Inc', currentPrice: 228.52, averagePrice: 195.00, quantity: 10, ppl: 335.2 },
  { ticker: 'MSFT', fullName: 'Microsoft Corporation', currentPrice: 415.30, averagePrice: 380.00, quantity: 5, ppl: 176.5 },
  { ticker: 'NVDA', fullName: 'NVIDIA Corporation', currentPrice: 875.50, averagePrice: 620.00, quantity: 3, ppl: 766.5 },
  { ticker: 'AMZN', fullName: 'Amazon.com Inc', currentPrice: 225.80, averagePrice: 195.00, quantity: 8, ppl: 246.4 },
  { ticker: 'GOOGL', fullName: 'Alphabet Inc', currentPrice: 180.50, averagePrice: 165.00, quantity: 12, ppl: 186.0 },
];

router.get('/status', async (req, res) => {
  try {
    const hasGroq = !!process.env.GROQ_API_KEY;
    const hasT212 = t212.hasKey();
    const lastRunKey = await cache.get('ai:last_run').catch(() => null);
    res.json({ hasGroq, hasT212, model: hasGroq ? 'llama-3.3-70b-versatile' : 'rule-based', lastRun: lastRunKey ? new Date(parseInt(lastRunKey)).toISOString() : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const portfolioResult = await t212.getPortfolio();
    const positions = portfolioResult.data?.length ? portfolioResult.data : DEMO_POSITIONS;
    const enriched = await enrichPositions(positions).catch(() => positions);
    const analysis = await analyseTop10(positions, Array.isArray(enriched) ? enriched : positions);
    const result = positions.slice(0, 10).map(pos => {
      const a = analysis.find(a => a.ticker === pos.ticker) || {};
      const name = pos.companyName || pos.fullName || pos.ticker;
      return {
        ticker: pos.ticker,
        companyName: name,
        fullName: name,
        currentPrice: pos.currentPrice,
        averagePrice: pos.averagePrice,
        ppl: pos.ppl,
        quantity: pos.quantity,
        ...a,
      };
    });
    await cache.setEx('ai:last_run', 86400, Date.now().toString()).catch(() => {});
    res.json(result);
  } catch (e) {
    console.error('[analysis] GET / failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const portfolioResult = await t212.getPortfolio();
    const positions = portfolioResult.data || DEMO_POSITIONS;
    const pos = positions.find(p => p.ticker?.replace(/_[A-Z]+_EQ$/, '') === ticker || p.ticker === ticker)
      || { ticker, fullName: ticker, currentPrice: 100, averagePrice: 100, quantity: 1 };
    const enriched = await enrichPositions([pos]).catch(() => [pos]);
    const market = Array.isArray(enriched) ? enriched[0]?.market : null;
    const analysis = await analysePosition(pos, market);
    res.json({ ticker, ...analysis });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/refresh', async (req, res) => {
  try {
    const keys = ['ai:last_run'];
    const portfolioResult = await t212.getPortfolio();
    const positions = portfolioResult.data?.length ? portfolioResult.data : DEMO_POSITIONS;
    await Promise.all(positions.slice(0, 10).map(pos => cache.del(`ai:v2:${pos.ticker}`).catch(() => {})));
    await Promise.all(keys.map(k => cache.del(k).catch(() => {})));
    res.json({ status: 'cleared', count: positions.length, message: 'Cache cleared — call GET /api/analysis to regenerate' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
