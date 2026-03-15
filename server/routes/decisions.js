const express = require('express');
const router = express.Router();
const { generateMasterSignal, generatePortfolioDecision } = require('../services/decisionEngine');
const cache = require('../services/cache');

router.get('/portfolio', async (req, res) => {
  try {
    const data = await generatePortfolioDecision();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/portfolio/refresh', async (req, res) => {
  try {
    await cache.del('decision:portfolio').catch(() => {});
    generatePortfolioDecision().catch(() => {});
    res.json({ triggered: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/macro', async (req, res) => {
  try {
    const { getMacroContext, getSectorPerformance } = require('../services/macroService');
    const [macro, sectors] = await Promise.allSettled([getMacroContext(), getSectorPerformance()]);
    res.json({
      macro: macro.status === 'fulfilled' ? macro.value : null,
      sectors: sectors.status === 'fulfilled' ? sectors.value : [],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/screener/:preset', async (req, res) => {
  try {
    const { query } = require('../models/db');
    const preset = req.params.preset;
    let sql = '';
    const presets = {
      strong_buy: `SELECT ta.ticker, ta.technical_score, ta.technical_grade, ta.technical_signal, ta.rsi_14, ta.trend, ta.ma_50, ta.ma_200, ta.nearest_support, ta.nearest_resistance
        FROM technical_analysis ta WHERE ta.technical_score > 70 AND ta.trend IN ('UPTREND','STRONG_UPTREND') ORDER BY ta.technical_score DESC LIMIT 20`,
      oversold_quality: `SELECT ta.ticker, ta.technical_score, ta.technical_grade, ta.rsi_14, ta.trend
        FROM technical_analysis ta WHERE CAST(ta.rsi_14 AS DECIMAL) < 35 AND ta.technical_grade IN ('A','B') ORDER BY ta.rsi_14 ASC LIMIT 20`,
      golden_cross: `SELECT ta.ticker, ta.technical_score, ta.technical_grade, ta.volume_ratio, ta.trend, ta.rsi_14
        FROM technical_analysis ta WHERE ta.golden_cross=true AND ta.trend='STRONG_UPTREND' ORDER BY ta.technical_score DESC LIMIT 20`,
      earnings_soon: `SELECT ec.ticker, ec.company, ec.report_date, ec.report_time, ec.eps_estimate, ec.ai_beat_probability, ec.ai_signal, ec.ai_confidence
        FROM earnings_calendar ec WHERE ec.report_date BETWEEN CURRENT_DATE AND CURRENT_DATE+14 AND ec.eps_actual IS NULL ORDER BY ec.report_date, ec.ai_beat_probability DESC NULLS LAST LIMIT 30`,
      congress_buys: `SELECT ct.ticker, ct.member_name, ct.party, ct.transaction_date, ct.amount_range, ct.transaction_type
        FROM congress_trades ct WHERE ct.transaction_type ILIKE '%purchase%' AND ct.transaction_date > CURRENT_DATE-30 ORDER BY ct.transaction_date DESC LIMIT 20`,
      insider_buys: `SELECT it.ticker, it.insider_name, it.title, it.trade_date, it.value, it.trade_type
        FROM insider_trades it WHERE it.trade_type='P' AND it.trade_date > CURRENT_DATE-60 ORDER BY it.value DESC NULLS LAST LIMIT 20`,
    };
    if (!presets[preset]) return res.status(404).json({ error: 'Unknown preset' });
    const { rows } = await query(presets[preset]);
    res.json({ preset, results: rows, count: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const forceRefresh = req.query.refresh === 'true';
    const data = await generateMasterSignal(ticker, forceRefresh);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:ticker/refresh', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    await cache.del('decision:' + ticker).catch(() => {});
    generateMasterSignal(ticker, true).catch(() => {});
    res.json({ triggered: true, ticker });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
