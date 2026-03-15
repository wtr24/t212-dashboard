'use strict';
const { query } = require('../models/db');
const { generateMasterSignal } = require('./decisionEngine');
const cache = require('./cache');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── 50 STRATEGIES ────────────────────────────────────────────────────────────
function buildStrategies() {
  const strats = [];

  // MOMENTUM (10) — buy when signal + trend up, stop loss on reversal
  const momRisks = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  momRisks.forEach((risk, i) => {
    const conf = 55 + i * 3; // 55..82
    const size = 25 - i * 2; // 25..7
    const stop = 15 - i;     // 15..6
    strats.push({
      name: `Momentum R${risk}`,
      type: 'MOMENTUM',
      risk,
      description: `Momentum: conf>=${conf}% size ${size}% stop ${stop}%`,
      rules: { minSignalConfidence: conf, positionSizeMaxPct: size, stopLossPct: stop, takeProfitPct: stop * 3, requireTrend: true, maxPositions: 20 - i },
    });
  });

  // MEAN REVERSION (10) — buy oversold, sell overbought
  const mrRisks = [9, 8, 7, 6, 5, 5, 4, 3, 2, 1];
  mrRisks.forEach((risk, i) => {
    const buyRsi = 38 - i * 2; // 38..20
    const sellRsi = 62 + i * 2; // 62..80
    const size = 20 - i;
    strats.push({
      name: `Mean Reversion R${risk}`,
      type: 'MEAN_REVERSION',
      risk,
      description: `MR: buy RSI<${buyRsi} sell RSI>${sellRsi} size ${size}%`,
      rules: { buyRsiMax: buyRsi, sellRsiMin: sellRsi, positionSizeMaxPct: size, stopLossPct: 12 - i, requireBollinger: i < 5, maxPositions: 15 - i },
    });
  });

  // SIGNALS ONLY (10) — pure decision engine follower at different confidence thresholds
  [55, 58, 61, 64, 67, 70, 73, 76, 80, 85].forEach((conf, i) => {
    const risk = 10 - i;
    strats.push({
      name: `Signal ${conf}% R${risk}`,
      type: 'SIGNALS_ONLY',
      risk,
      description: `Follow signals at ${conf}% confidence, exit on SELL`,
      rules: { minConfidence: conf, positionSizeMaxPct: 20 - i * 1.5, stopLossPct: 8 + i, exitOnSell: true, maxPositions: 15 },
    });
  });

  // VALUE (8) — buy quality at discount
  [[15, 8, 7], [18, 7, 6], [20, 6, 6], [22, 6, 5], [25, 5, 5], [25, 5, 4], [30, 4, 4], [35, 3, 3]].forEach(([maxPe, risk, size], i) => {
    strats.push({
      name: `Value PE<${maxPe} R${risk}`,
      type: 'VALUE',
      risk,
      description: `Value: PE<${maxPe} oversold RSI size ${size}%`,
      rules: { maxPE: maxPe, maxRSIEntry: 50 + i * 3, positionSizeMaxPct: size * 2, stopLossPct: 10 - i, minSignalConfidence: 50, maxPositions: 10 },
    });
  });

  // EARNINGS (6) — trade around earnings catalysts
  [[5, 70, 9], [7, 65, 7], [10, 60, 6], [14, 55, 5], [5, 80, 4], [3, 75, 8]].forEach(([days, beatProb, risk], i) => {
    strats.push({
      name: `Earnings ${days}d R${risk}`,
      type: 'EARNINGS',
      risk,
      description: `Buy ${days}d before earnings if beat prob>${beatProb}%`,
      rules: { buyDaysBeforeEarnings: days, sellDaysAfterEarnings: 2, minAiBeatProbability: beatProb, positionSizeMaxPct: 15 - i, stopLossPct: 12 - i, maxPositions: 8 },
    });
  });

  // TREND FOLLOWING (6) — strict trend requirements
  [[true, true, 10, 5], [true, false, 8, 6], [false, true, 7, 7], [false, false, 5, 8], [true, true, 12, 4], [false, false, 6, 9]].forEach(([gc, aboveBoth, size, risk], i) => {
    strats.push({
      name: `Trend ${gc ? 'GC' : 'MA'} R${risk}`,
      type: 'TREND_FOLLOWING',
      risk,
      description: `Trend: ${gc ? 'golden cross required' : 'above 50MA'} size ${size}%`,
      rules: { requireGoldenCross: gc, requireAboveBothMAs: aboveBoth, positionSizeMaxPct: size, stopLossPct: 10 - i, minSignalConfidence: 55 + i * 4, maxPositions: 12 },
    });
  });

  return strats.slice(0, 50); // ensure max 50
}

const STRATEGIES = buildStrategies();

// ─── STRATEGY EXECUTION ────────────────────────────────────────────────────────
async function executeStrategy(portfolio, positions, signal, ta) {
  const rules = portfolio.rules || {};
  const currentPrice = signal.price ? (signal.price.price || signal.price.regularMarketPrice) : null;
  if (!currentPrice) return { action: 'HOLD' };

  const existing = positions.find(p => p.ticker === signal.ticker);
  const portfolioValue = positions.reduce((s, p) => s + (parseFloat(p.current_value) || 0), 0) + parseFloat(portfolio.cash || 0);
  const maxPositionValue = portfolioValue * ((rules.positionSizeMaxPct || 10) / 100);
  const positionCount = positions.length;

  let shouldBuy = false, buyReason = '';
  const rsi = signal.rsi || (ta ? parseFloat(ta.rsi_14) : null);
  const trend = signal.trend || ta?.trend;

  if (portfolio.strategy_type === 'MOMENTUM') {
    shouldBuy = signal.confidence >= (rules.minSignalConfidence || 65)
      && signal.signal.includes('BUY')
      && (!rules.requireTrend || (trend && trend.includes('UP')));
    buyReason = `Momentum conf=${signal.confidence}% trend=${trend}`;
  } else if (portfolio.strategy_type === 'MEAN_REVERSION') {
    shouldBuy = rsi !== null && rsi <= (rules.buyRsiMax || 30)
      && (!rules.requireBollinger || signal.bullEvidence?.some(e => e.fact.includes('Bollinger')));
    buyReason = `MR RSI=${rsi?.toFixed(0)}`;
  } else if (portfolio.strategy_type === 'SIGNALS_ONLY') {
    shouldBuy = signal.confidence >= (rules.minConfidence || 65) && signal.signal.includes('BUY');
    buyReason = `Signal ${signal.confidence}%`;
  } else if (portfolio.strategy_type === 'VALUE') {
    shouldBuy = signal.confidence >= (rules.minSignalConfidence || 50)
      && rsi !== null && rsi <= (rules.maxRSIEntry || 50)
      && signal.signal.includes('BUY');
    buyReason = `Value RSI=${rsi?.toFixed(0)} conf=${signal.confidence}%`;
  } else if (portfolio.strategy_type === 'EARNINGS') {
    const upcoming = signal.catalysts?.find(c => c.fact.includes('Earnings'));
    const daysMatch = upcoming && (() => {
      const m = upcoming.fact.match(/(\d+) day/);
      return m && parseInt(m[1]) <= (rules.buyDaysBeforeEarnings || 7);
    })();
    const beatProb = signal.bullEvidence?.find(e => e.fact.includes('beat probability'));
    const probMatch = !rules.minAiBeatProbability || (beatProb && (() => {
      const m = beatProb.fact.match(/(\d+)%/);
      return m && parseInt(m[1]) >= rules.minAiBeatProbability;
    })());
    shouldBuy = !!(daysMatch && probMatch);
    buyReason = `Earnings play`;
  } else if (portfolio.strategy_type === 'TREND_FOLLOWING') {
    const hasGC = signal.bullEvidence?.some(e => e.fact.includes('Golden cross'));
    const isStrongUp = trend === 'STRONG_UPTREND';
    shouldBuy = signal.confidence >= (rules.minSignalConfidence || 60)
      && signal.signal.includes('BUY')
      && (!rules.requireGoldenCross || hasGC)
      && (!rules.requireAboveBothMAs || isStrongUp);
    buyReason = `Trend ${trend}${hasGC ? ' GC' : ''}`;
  }

  // BUY execution
  if (shouldBuy && !existing && parseFloat(portfolio.cash) >= maxPositionValue * 0.4 && positionCount < (rules.maxPositions || 15)) {
    const quantity = Math.floor((maxPositionValue / currentPrice) * 100) / 100;
    const cost = quantity * currentPrice;
    if (parseFloat(portfolio.cash) >= cost && cost > 0 && quantity > 0) {
      await executePaperTrade(portfolio.id, signal.ticker, 'BUY', quantity, currentPrice, signal.confidence, signal.signal, buyReason);
      return { action: 'BUY', quantity, cost, reason: buyReason };
    }
  }

  // SELL check
  if (existing) {
    const avgCost = parseFloat(existing.avg_cost);
    const pnlPct = avgCost > 0 ? (currentPrice - avgCost) / avgCost * 100 : 0;
    let shouldSell = false, sellReason = '';

    if (pnlPct <= -(rules.stopLossPct || 10)) {
      shouldSell = true;
      sellReason = `STOP LOSS ${pnlPct.toFixed(1)}%`;
    } else if (rules.takeProfitPct && pnlPct >= rules.takeProfitPct) {
      shouldSell = true;
      sellReason = `TAKE PROFIT +${pnlPct.toFixed(1)}%`;
    } else if (portfolio.strategy_type === 'MEAN_REVERSION' && rsi !== null && rsi >= (rules.sellRsiMin || 65)) {
      shouldSell = true;
      sellReason = `MR sell RSI=${rsi.toFixed(0)}`;
    } else if (portfolio.strategy_type === 'SIGNALS_ONLY' && rules.exitOnSell && signal.signal.includes('SELL')) {
      shouldSell = true;
      sellReason = `Signal SELL ${signal.confidence}%`;
    }

    if (shouldSell) {
      await executePaperTrade(portfolio.id, signal.ticker, 'SELL', parseFloat(existing.quantity), currentPrice, signal.confidence, signal.signal, sellReason);
      return { action: 'SELL', pnlPct, reason: sellReason };
    }
  }

  return { action: 'HOLD' };
}

async function executePaperTrade(portfolioId, ticker, action, quantity, price, confidence, signalType, reason) {
  const total = quantity * price;
  await query(
    'INSERT INTO paper_trades (portfolio_id,ticker,action,quantity,price,total_value,signal_confidence,signal_type,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [portfolioId, ticker, action, quantity, price, total, confidence, signalType, reason]
  );

  if (action === 'BUY') {
    await query('UPDATE paper_portfolios SET cash=cash-$1, total_trades=total_trades+1 WHERE id=$2', [total, portfolioId]);
    await query(
      `INSERT INTO paper_positions (portfolio_id,ticker,quantity,avg_cost,current_price,current_value)
       VALUES ($1,$2,$3,$4,$4,$5)
       ON CONFLICT(portfolio_id,ticker) DO UPDATE
       SET quantity=paper_positions.quantity+$3,
           avg_cost=(paper_positions.avg_cost*paper_positions.quantity+$4*$3)/(paper_positions.quantity+$3),
           current_price=$4, current_value=(paper_positions.quantity+$3)*$4`,
      [portfolioId, ticker, quantity, price, total]
    );
  } else {
    const prevR = await query('SELECT avg_cost FROM paper_positions WHERE portfolio_id=$1 AND ticker=$2', [portfolioId, ticker]);
    const avgCost = parseFloat(prevR.rows[0]?.avg_cost || price);
    const pnl = (price - avgCost) * quantity;
    await query(
      'UPDATE paper_portfolios SET cash=cash+$1, total_trades=total_trades+1, winning_trades=winning_trades+$2 WHERE id=$3',
      [total, pnl > 0 ? 1 : 0, portfolioId]
    );
    await query('DELETE FROM paper_positions WHERE portfolio_id=$1 AND ticker=$2', [portfolioId, ticker]);
  }
  console.log(`[paper] ${action} ${ticker} ${quantity}@${price.toFixed(2)} portfolio=${portfolioId} reason=${reason}`);
}

// ─── INIT: Clone real portfolio into 50 paper portfolios ──────────────────────
async function initPaperPortfolios() {
  const existing = await query('SELECT COUNT(*) as n FROM paper_portfolios');
  if (parseInt(existing.rows[0].n) > 0) {
    console.log('[paper] Already initialised:', existing.rows[0].n, 'portfolios');
    return { skipped: true, count: parseInt(existing.rows[0].n) };
  }

  const { getPortfolio } = require('./t212');
  const portfolioResult = await getPortfolio().catch(() => ({ data: [] }));
  const realPositions = portfolioResult?.data || portfolioResult || [];
  const totalValue = realPositions.reduce((s, p) => s + ((p.currentPrice || 0) * (p.quantity || 0)), 0);
  const startingCash = totalValue * 0.1; // 10% cash reserve

  console.log(`[paper] Initialising ${STRATEGIES.length} portfolios (clone of real T212, £${totalValue.toFixed(2)} total)`);

  for (const strat of STRATEGIES) {
    const r = await query(
      `INSERT INTO paper_portfolios (name,strategy_type,risk_level,starting_value,current_value,cash,description,rules)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7) RETURNING id`,
      [strat.name, strat.type, strat.risk, totalValue, startingCash, strat.description, JSON.stringify(strat.rules)]
    );
    const portfolioId = r.rows[0].id;

    for (const pos of realPositions) {
      if (!pos.ticker || !pos.quantity || !pos.currentPrice) continue;
      const cv = pos.currentPrice * pos.quantity;
      await query(
        `INSERT INTO paper_positions (portfolio_id,ticker,company,quantity,avg_cost,current_price,current_value)
         VALUES ($1,$2,$3,$4,$5,$5,$6) ON CONFLICT DO NOTHING`,
        [portfolioId, pos.ticker, pos.companyName || pos.ticker, pos.quantity, pos.currentPrice, cv]
      );
    }
    console.log(`[paper] Created: ${strat.name} (risk ${strat.risk}/10)`);
    await sleep(10);
  }

  // Take initial snapshot
  await takeSnapshots();
  console.log(`[paper] Init complete: ${STRATEGIES.length} portfolios`);
  return { initialised: STRATEGIES.length, startingValue: totalValue };
}

// ─── DAILY SIMULATION ─────────────────────────────────────────────────────────
async function runDailySimulation() {
  console.log('[paper] Starting daily simulation...');
  const portfolios = await query('SELECT * FROM paper_portfolios ORDER BY id');
  if (!portfolios.rows.length) {
    console.log('[paper] No portfolios found, run initPaperPortfolios first');
    return { error: 'not_initialised' };
  }

  // Get all unique tickers
  const tickerRows = await query('SELECT DISTINCT ticker FROM paper_positions');
  const tickers = tickerRows.rows.map(r => r.ticker);
  console.log(`[paper] Fetching signals for ${tickers.length} tickers...`);

  // Fetch signals once, shared across all portfolios
  const signals = {};
  for (const ticker of tickers) {
    try {
      signals[ticker] = await generateMasterSignal(ticker);
      await sleep(200);
    } catch (e) {
      console.log(`[paper] signal fail for ${ticker}:`, e.message);
    }
  }

  let executed = 0, held = 0;

  for (const portfolio of portfolios.rows) {
    const posR = await query('SELECT * FROM paper_positions WHERE portfolio_id=$1', [portfolio.id]);
    const positions = posR.rows;

    for (const ticker of tickers) {
      const sig = signals[ticker];
      if (!sig || !sig.price) continue;

      const price = sig.price.price || sig.price.regularMarketPrice;
      if (!price) continue;

      // Update current price for this ticker in this portfolio
      await query(
        `UPDATE paper_positions SET current_price=$1, current_value=quantity*$1,
         unrealised_pnl=(quantity*$1)-(quantity*avg_cost),
         unrealised_pnl_pct=((($1-avg_cost)/avg_cost)*100),
         last_updated=NOW()
         WHERE portfolio_id=$2 AND ticker=$3`,
        [price, portfolio.id, ticker]
      );

      const decision = await executeStrategy(portfolio, positions, sig, null).catch(() => ({ action: 'HOLD' }));
      if (decision.action !== 'HOLD') executed++;
      else held++;
    }

    // Update portfolio totals
    const totR = await query('SELECT SUM(current_value) as total FROM paper_positions WHERE portfolio_id=$1', [portfolio.id]);
    const posTotal = parseFloat(totR.rows[0].total || 0);
    const cashR = await query('SELECT cash FROM paper_portfolios WHERE id=$1', [portfolio.id]);
    const cash = parseFloat(cashR.rows[0].cash || 0);
    const totalValue = posTotal + cash;
    const startVal = parseFloat(portfolio.starting_value || totalValue);
    const returnPct = startVal > 0 ? (totalValue - startVal) / startVal * 100 : 0;

    await query(
      'UPDATE paper_portfolios SET current_value=$1, total_return_pct=$2, last_updated=NOW() WHERE id=$3',
      [totalValue, returnPct, portfolio.id]
    );
  }

  await takeSnapshots();
  console.log(`[paper] Simulation done: ${executed} trades, ${held} held`);
  return { executed, held, portfolios: portfolios.rows.length };
}

async function takeSnapshots() {
  const portfolios = await query('SELECT id, current_value, cash, total_return_pct FROM paper_portfolios');
  for (const p of portfolios.rows) {
    await query(
      `INSERT INTO paper_snapshots (portfolio_id, total_value, cash, return_pct)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (portfolio_id, snapshot_date)
       DO UPDATE SET total_value=$2, cash=$3, return_pct=$4`,
      [p.id, p.current_value, p.cash, p.total_return_pct]
    );
  }
}

module.exports = { initPaperPortfolios, runDailySimulation, STRATEGIES };
