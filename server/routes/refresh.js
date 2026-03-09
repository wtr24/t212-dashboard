const express = require('express');
const router = express.Router();
const cache = require('../services/cache');
const t212 = require('../services/t212');

const KEYS = {
  portfolio: ['t212:portfolio', 't212:cash', 't212:info'],
  market: [],
  community: [],
  analysis: [],
  all: ['t212:portfolio', 't212:cash', 't212:info', 't212:orders', 't212:dividends', 't212:transactions', 't212:pies'],
};

router.post('/:source', async (req, res) => {
  try {
    const { source } = req.params;
    const keys = KEYS[source] || KEYS.all;
    await Promise.all(keys.map(k => cache.del(k)));

    const [portfolioResult, cashResult] = await Promise.all([t212.getPortfolio(), t212.getCash()]);
    const portfolio = portfolioResult.data || [];
    const cash = cashResult.data || {};
    const metrics = t212.calcMetrics(portfolio, cash);

    res.json({
      ok: true,
      source,
      positionCount: portfolio.length,
      totalValue: metrics.totalValue,
      dataSource: portfolioResult.source,
      hasApiKey: t212.hasKey(),
      timestamp: new Date(),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/status', async (req, res) => {
  try {
    const { query } = require('../models/db');
    const posRow = await query('SELECT updated_at, COUNT(*) as count FROM positions GROUP BY updated_at ORDER BY updated_at DESC LIMIT 1').catch(() => ({ rows: [] }));
    const cashRow = await query("SELECT updated_at FROM account_cache WHERE key='cash'").catch(() => ({ rows: [] }));
    res.json({
      hasApiKey: t212.hasKey(),
      positions: { count: posRow.rows[0]?.count || 0, lastUpdated: posRow.rows[0]?.updated_at },
      cash: { lastUpdated: cashRow.rows[0]?.updated_at },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
