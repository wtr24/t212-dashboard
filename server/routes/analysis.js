const express = require('express');
const router = express.Router();
const t212 = require('../services/t212');
const { enrichPositions } = require('../services/marketData');
const { analyseTop10 } = require('../services/aiAnalysis');

router.get('/', async (req, res) => {
  try {
    const portfolio = await t212.getPortfolio();
    const enriched = await enrichPositions(portfolio);
    const analysis = await analyseTop10(portfolio, enriched);
    res.json(analysis);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
