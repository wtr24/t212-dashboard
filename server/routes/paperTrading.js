const express = require('express');
const router = express.Router();
const { query } = require('../models/db');
const { initPaperPortfolios, runDailySimulation } = require('../services/paperTrading');

async function getRealReturnPct() {
  try {
    const t212 = require('../services/t212');
    const [summaryResult, portfolioResult] = await Promise.all([
      t212.getAccountSummary(),
      t212.getPortfolio(),
    ]);
    const metrics = t212.calcMetrics(portfolioResult.data, summaryResult.data);
    return parseFloat(metrics.returnPct || 0);
  } catch(e) {
    return 0;
  }
}

router.get('/portfolios', async (req, res) => {
  try {
    const portfolios = await query(`
      SELECT pp.*,
        (SELECT COUNT(*) FROM paper_positions WHERE portfolio_id=pp.id AND quantity>0) as position_count,
        (SELECT COUNT(*) FROM paper_trades WHERE portfolio_id=pp.id) as trade_count,
        CASE WHEN pp.total_trades > 0
          THEN ROUND(pp.winning_trades::numeric / pp.total_trades * 100, 1)
          ELSE 0 END as win_rate
      FROM paper_portfolios pp
      ORDER BY pp.total_return_pct DESC NULLS LAST
    `);

    const realReturnPct = await getRealReturnPct();

    const ranked = portfolios.rows.map((p, i) => ({
      ...p,
      rank: i + 1,
      beating_real: parseFloat(p.total_return_pct || 0) > realReturnPct,
      vs_real_pct: (parseFloat(p.total_return_pct || 0) - realReturnPct).toFixed(2)
    }));

    res.json({ data: ranked, realReturnPct, count: ranked.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/portfolios/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [portfolio, positions, trades, snapshots] = await Promise.all([
      query('SELECT * FROM paper_portfolios WHERE id=$1', [id]),
      query('SELECT * FROM paper_positions WHERE portfolio_id=$1 ORDER BY current_value DESC NULLS LAST', [id]),
      query('SELECT * FROM paper_trades WHERE portfolio_id=$1 ORDER BY executed_at DESC LIMIT 50', [id]),
      query('SELECT * FROM paper_snapshots WHERE portfolio_id=$1 ORDER BY snapshot_date ASC', [id])
    ]);
    if (!portfolio.rows[0]) return res.status(404).json({ error: 'not found' });
    const trades_arr = trades.rows;
    const wins = trades_arr.filter(t => t.action==='SELL' && parseFloat(t.pnl||0) > 0).length;
    const losses = trades_arr.filter(t => t.action==='SELL' && parseFloat(t.pnl||0) <= 0).length;
    const totalPnl = trades_arr.filter(t=>t.action==='SELL').reduce((s,t)=>s+parseFloat(t.pnl||0),0);
    res.json({
      portfolio: portfolio.rows[0],
      positions: positions.rows,
      trades: trades_arr,
      recentTrades: trades_arr,
      snapshots: snapshots.rows,
      stats: { wins, losses, winRate: wins+losses > 0 ? (wins/(wins+losses)*100).toFixed(1) : 0, totalPnl: totalPnl.toFixed(2) }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const all = await query(`
      SELECT id, name, strategy_type, risk_level, current_value, starting_value,
             total_return_pct, total_trades, winning_trades,
             CASE WHEN total_trades > 0 THEN ROUND(winning_trades::numeric/total_trades*100) ELSE 0 END as win_rate
      FROM paper_portfolios
      ORDER BY total_return_pct DESC NULLS LAST
    `);
    const ranked = all.rows.map((r, i) => ({ ...r, rank: i + 1 }));
    res.json({ top10: ranked.slice(0,10), bottom10: ranked.slice(-10).reverse(), all: ranked, total: ranked.length, count: ranked.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/comparison', async (req, res) => {
  try {
    const portfolios = await query('SELECT name, strategy_type, risk_level, total_return_pct FROM paper_portfolios ORDER BY total_return_pct DESC');
    const realReturn = await getRealReturnPct();
    const rank = portfolios.rows.filter(p => parseFloat(p.total_return_pct||0) > realReturn).length + 1;
    res.json({ yourReturn: realReturn, yourRank: rank, totalPortfolios: portfolios.rows.length+1, portfolios: portfolios.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/strategy-analysis', async (req, res) => {
  try {
    const data = await query(`
      SELECT strategy_type,
        COUNT(*) as count,
        ROUND(AVG(total_return_pct)::numeric, 2) as avg_return,
        ROUND(MAX(total_return_pct)::numeric, 2) as best_return,
        ROUND(MIN(total_return_pct)::numeric, 2) as worst_return,
        ROUND(AVG(CASE WHEN total_trades>0 THEN winning_trades::numeric/total_trades*100 ELSE 0 END)::numeric, 1) as avg_win_rate,
        ROUND(AVG(risk_level)::numeric, 1) as avg_risk
      FROM paper_portfolios
      GROUP BY strategy_type ORDER BY avg_return DESC
    `);
    const scatter = await query('SELECT name, risk_level, total_return_pct, strategy_type, total_trades FROM paper_portfolios ORDER BY risk_level');
    const scatterMapped = scatter.rows.map(p => ({
      name: p.name,
      type: p.strategy_type,
      risk: p.risk_level,
      return: parseFloat(p.total_return_pct || 0),
      trades: p.total_trades,
      risk_level: p.risk_level,
      total_return_pct: p.total_return_pct,
      strategy_type: p.strategy_type
    }));
    res.json({ byStrategy: data.rows, scatter: scatterMapped });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/best-recommendation', async (req, res) => {
  try {
    const [best, byType, daysR] = await Promise.all([
      query('SELECT * FROM paper_portfolios ORDER BY total_return_pct DESC LIMIT 1'),
      query('SELECT strategy_type, AVG(total_return_pct) as avg FROM paper_portfolios GROUP BY strategy_type ORDER BY avg DESC'),
      query('SELECT COUNT(DISTINCT snapshot_date) as days FROM paper_snapshots')
    ]);
    const bestPortfolio = best.rows[0];
    const realReturn = await getRealReturnPct();
    const days = parseInt(daysR.rows[0] && daysR.rows[0].days || 0);
    const diff = bestPortfolio ? (parseFloat(bestPortfolio.total_return_pct||0) - realReturn).toFixed(2) : 0;
    res.json({
      bestStrategy: bestPortfolio,
      best: best.rows,
      realReturn,
      returnDiff: diff,
      bestStrategyType: byType.rows[0],
      simulationDays: days,
      recommendation: bestPortfolio
        ? 'The ' + bestPortfolio.name + ' approach (' + bestPortfolio.strategy_type + ', risk ' + bestPortfolio.risk_level + '/10) has returned ' + parseFloat(bestPortfolio.total_return_pct||0).toFixed(2) + '% vs your real portfolio ' + realReturn.toFixed(2) + '%. Difference: ' + (diff > 0 ? '+' : '') + diff + '%.'
        : 'Run simulation first to get recommendations.'
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/init', async (req, res) => {
  try {
    const result = await initPaperPortfolios();
    res.json({ success: true, ...result });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/run-simulation', async (req, res) => {
  try {
    res.json({ started: true, message: 'Simulation running in background' });
    runDailySimulation().then(r => console.log('SIM COMPLETE:', r)).catch(e => console.log('SIM ERROR:', e.message));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/reset', async (req, res) => {
  try {
    await query('DELETE FROM paper_snapshots');
    await query('DELETE FROM paper_trades');
    await query('DELETE FROM paper_positions');
    await query('DELETE FROM paper_portfolios');
    res.json({ ok: true, message: 'All paper portfolios deleted' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
