const express = require('express');
const router = express.Router();
const t212 = require('../services/t212');
const { enrichPositions } = require('../services/marketData');
const { getAllSentiment } = require('../services/community');
const { analyseTop10 } = require('../services/aiAnalysis');

router.get('/summary', async (req, res) => {
  try {
    const [portfolioResult, cashResult, infoResult] = await Promise.all([
      t212.getPortfolio(), t212.getCash(), t212.getAccountInfo()
    ]);
    const portfolio = portfolioResult.data || [];
    const cash = cashResult.data || {};
    const info = infoResult.data || {};
    const metrics = t212.calcMetrics(portfolio, cash);
    res.json({
      ...metrics,
      cash,
      info,
      meta: {
        portfolioSource: portfolioResult.source,
        cashSource: cashResult.source,
        portfolioAge: portfolioResult.age,
        cashAge: cashResult.age,
        hasApiKey: t212.hasKey(),
        positionCount: portfolio.length,
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/positions', async (req, res) => {
  try {
    const portfolioResult = await t212.getPortfolio();
    const portfolio = portfolioResult.data || [];
    const enriched = await enrichPositions(portfolio);
    const tickers = portfolio.map(p => p.ticker);
    const [sentiment, analysis] = await Promise.all([
      getAllSentiment(tickers),
      analyseTop10(portfolio, enriched),
    ]);
    const positions = enriched.map(pos => ({
      ...pos,
      sentiment: sentiment.find(s => s.ticker === pos.ticker),
      analysis: analysis.find(a => a.ticker === pos.ticker),
    }));
    res.json({ positions, source: portfolioResult.source, age: portfolioResult.age });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/best', async (req, res) => {
  try {
    const { data: portfolio } = await t212.getPortfolio();
    const { best } = t212.calcMetrics(portfolio, {});
    res.json(best);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/worst', async (req, res) => {
  try {
    const { data: portfolio } = await t212.getPortfolio();
    const { worst } = t212.calcMetrics(portfolio, {});
    res.json(worst);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/allocation', async (req, res) => {
  try {
    const { data: portfolio } = await t212.getPortfolio();
    const enriched = await enrichPositions(portfolio);
    const total = enriched.reduce((s, p) => s + ((p.currentPrice || 0) * (p.quantity || 0)), 0);
    const byStock = enriched.map(p => ({
      ticker: p.ticker, name: p.fullName,
      value: (p.currentPrice || 0) * (p.quantity || 0),
      pct: total > 0 ? (((p.currentPrice || 0) * (p.quantity || 0)) / total) * 100 : 0,
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
    const total = dividends.reduce((s, d) => s + (d.amount || d.grossAmount || 0), 0);
    res.json({ dividends, totalReceived: total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const transactions = await t212.getTransactions();
    const netDeposits = transactions.filter(t => (t.type || '').toLowerCase().includes('deposit'))
      .reduce((s, t) => s + (t.amount || 0), 0);
    res.json({ transactions, netDeposits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const [portfolioResult, cashResult, infoResult] = await Promise.all([
      t212.getPortfolio(), t212.getCash(), t212.getAccountInfo()
    ]);
    const metrics = t212.calcMetrics(portfolioResult.data || [], cashResult.data || {});
    res.json({ portfolio: portfolioResult.data, cash: cashResult.data, info: infoResult.data, metrics });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
