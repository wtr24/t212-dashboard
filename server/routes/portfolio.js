const express = require('express');
const router = express.Router();
const t212 = require('../services/t212');
const { enrichPositions } = require('../services/marketData');
const { getAllSentiment } = require('../services/community');
const { analyseTop10 } = require('../services/aiAnalysis');

router.get('/summary', async (req, res) => {
  try {
    const [summaryResult, portfolioResult] = await Promise.all([
      t212.getAccountSummary(),
      t212.getPortfolio(),
    ]);
    const metrics = t212.calcMetrics(portfolioResult.data, summaryResult.data);
    res.json({
      ...metrics,
      summary: summaryResult.data,
      meta: {
        source: portfolioResult.source,
        age: portfolioResult.age,
        hasApiKey: t212.hasKey(),
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/positions', async (req, res) => {
  try {
    const portfolioResult = await t212.getPortfolio();
    const positions = portfolioResult.data || [];
    const enriched = await enrichPositions(positions);
    const tickers = positions.map(p => p.ticker);
    const [sentiment, analysis] = await Promise.all([
      getAllSentiment(tickers),
      analyseTop10(positions, enriched),
    ]);
    res.json({
      positions: enriched.map(pos => {
        const cost = (pos.averagePrice || 0) * (pos.quantity || 1);
        const pplPercentage = cost > 0 ? Math.round((pos.ppl / cost) * 1000) / 10 : 0;
        return {
          ...pos,
          pplPercentage,
          sentiment: sentiment.find(s => s.ticker === pos.ticker),
          analysis: analysis.find(a => a.ticker === pos.ticker),
        };
      }),
      source: portfolioResult.source,
      age: portfolioResult.age,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/allocation', async (req, res) => {
  try {
    const { data: positions } = await t212.getPortfolio();
    const total = positions.reduce((s, p) => s + (p.currentPrice * p.quantity), 0);
    const byStock = positions.map(p => ({
      ticker: p.ticker,
      value: p.currentPrice * p.quantity,
      pct: total > 0 ? ((p.currentPrice * p.quantity) / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
    res.json({ byStock, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', async (req, res) => {
  try { res.json(await t212.getOrders()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dividends', async (req, res) => {
  try {
    const dividends = await t212.getDividends();
    res.json({ dividends, totalReceived: dividends.reduce((s, d) => s + (d.amount || 0), 0) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const transactions = await t212.getTransactions();
    const netDeposits = transactions.filter(t => t.type === 'DEPOSIT').reduce((s, t) => s + (t.amount || 0), 0);
    res.json({ transactions, netDeposits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
