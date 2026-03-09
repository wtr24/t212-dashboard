const express = require('express');
const router = express.Router();
const t212 = require('../services/t212');
const { getAllSentiment } = require('../services/community');

router.get('/', async (req, res) => {
  try {
    const portfolio = await t212.getPortfolio();
    const tickers = portfolio.map(p => p.ticker);
    const sentiment = await getAllSentiment(tickers);
    res.json(sentiment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
