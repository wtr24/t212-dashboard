const express = require('express');
const router = express.Router();
const { query } = require('../models/db');
const { initPaperPortfolios, runDailySimulation } = require('../services/paperTrading');

// All portfolios sorted by return
router.get('/portfolios', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT pp.*,
        (SELECT COUNT(*) FROM paper_trades pt WHERE pt.portfolio_id=pp.id) as trade_count,
        (SELECT COUNT(*) FROM paper_positions pos WHERE pos.portfolio_id=pp.id) as position_count
      FROM paper_portfolios pp
      ORDER BY total_return_pct DESC
    `);
    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    res.json(ranked);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Leaderboard: top 10 + bottom 10
router.get('/leaderboard', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT pp.id, pp.name, pp.strategy_type, pp.risk_level, pp.current_value,
             pp.total_return_pct, pp.total_trades, pp.winning_trades,
             pp.starting_value, pp.last_updated,
             CASE WHEN pp.total_trades > 0 THEN ROUND(pp.winning_trades::decimal/pp.total_trades*100) ELSE 0 END as win_rate
      FROM paper_portfolios pp
      ORDER BY total_return_pct DESC
    `);
    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    res.json({
      top10: ranked.slice(0, 10),
      bottom10: ranked.slice(-10).reverse(),
      all: ranked,
      count: ranked.length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Individual portfolio detail
router.get('/portfolios/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [portR, posR, tradesR, snapR] = await Promise.all([
      query('SELECT * FROM paper_portfolios WHERE id=$1', [id]),
      query('SELECT * FROM paper_positions WHERE portfolio_id=$1 ORDER BY current_value DESC', [id]),
      query('SELECT * FROM paper_trades WHERE portfolio_id=$1 ORDER BY executed_at DESC LIMIT 20', [id]),
      query('SELECT * FROM paper_snapshots WHERE portfolio_id=$1 ORDER BY snapshot_date ASC', [id]),
    ]);
    if (!portR.rows.length) return res.status(404).json({ error: 'Not found' });
    const port = portR.rows[0];
    const winRate = port.total_trades > 0 ? Math.round(port.winning_trades / port.total_trades * 100) : 0;
    res.json({
      portfolio: { ...port, winRate },
      positions: posR.rows,
      recentTrades: tradesR.rows,
      snapshots: snapR.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Strategy analysis: grouped by type
router.get('/strategy-analysis', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT strategy_type, risk_level,
        AVG(total_return_pct) as avg_return,
        MAX(total_return_pct) as best_return,
        MIN(total_return_pct) as worst_return,
        COUNT(*) as count,
        AVG(CASE WHEN total_trades > 0 THEN winning_trades::decimal/total_trades*100 ELSE 0 END) as avg_win_rate
      FROM paper_portfolios
      GROUP BY strategy_type, risk_level
      ORDER BY avg_return DESC
    `);

    const byType = {};
    rows.forEach(r => {
      if (!byType[r.strategy_type]) byType[r.strategy_type] = [];
      byType[r.strategy_type].push(r);
    });

    // Risk vs return scatter data
    const allPortfolios = await query('SELECT name, strategy_type, risk_level, total_return_pct, total_trades FROM paper_portfolios ORDER BY risk_level');
    const scatter = allPortfolios.rows.map(p => ({
      name: p.name,
      type: p.strategy_type,
      risk: p.risk_level,
      return: parseFloat(p.total_return_pct || 0),
      trades: p.total_trades,
    }));

    res.json({ byType, scatter });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Best recommendation
router.get('/best-recommendation', async (req, res) => {
  try {
    const [bestR, worstR, daysR] = await Promise.all([
      query('SELECT * FROM paper_portfolios ORDER BY total_return_pct DESC LIMIT 3'),
      query('SELECT * FROM paper_portfolios ORDER BY total_return_pct ASC LIMIT 3'),
      query('SELECT MIN(snapshot_date) as first_day, MAX(snapshot_date) as last_day, COUNT(DISTINCT snapshot_date) as days FROM paper_snapshots'),
    ]);

    const best = bestR.rows[0];
    const days = parseInt(daysR.rows[0]?.days || 0);

    let recommendation = 'Run the simulation for a few days to get meaningful recommendations.';
    if (best && days >= 3) {
      const returnDiff = parseFloat(best.total_return_pct || 0);
      const winRate = best.total_trades > 0 ? Math.round(best.winning_trades / best.total_trades * 100) : 0;
      recommendation = `After ${days} simulation days, "${best.name}" leads with ${returnDiff.toFixed(2)}% return and ${winRate}% win rate. Strategy: ${best.description}`;
    }

    res.json({
      best: bestR.rows,
      worst: worstR.rows,
      simulationDays: days,
      recommendation,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Init
router.post('/init', async (req, res) => {
  try {
    const result = await initPaperPortfolios();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Manual simulation trigger
router.post('/run-simulation', async (req, res) => {
  try {
    const result = await runDailySimulation();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reset (for testing)
router.delete('/reset', async (req, res) => {
  try {
    await query('DELETE FROM paper_snapshots');
    await query('DELETE FROM paper_trades');
    await query('DELETE FROM paper_positions');
    await query('DELETE FROM paper_portfolios');
    res.json({ ok: true, message: 'All paper portfolios deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
