const express = require('express');
const router = express.Router();
const { getFullResearch, getQuickResearch } = require('../services/stockResearch');
const cache = require('../services/cache');

router.get('/:ticker/quick', async (req, res) => {
  try {
    const data = await getQuickResearch(req.params.ticker.toUpperCase());
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const data = await getFullResearch(ticker, req.query.refresh === 'true');
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:ticker/refresh', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    await Promise.allSettled([
      cache.del('research_full_' + ticker),
      cache.del('research_quick_' + ticker),
      cache.del('research_ai_' + ticker),
    ]);
    getFullResearch(ticker, true).catch(e => console.error('[research refresh]', e.message));
    res.json({ triggered: true, ticker });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
