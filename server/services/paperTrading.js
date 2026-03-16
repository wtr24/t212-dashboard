'use strict';
const { query, pool } = require('../models/db');

function generateStrategies() {
  const strategies = [];

  const momentumRisks = [2,3,4,5,6,7,7,8,9,10];
  const momentumNames = ['Ultra Cautious','Very Cautious','Cautious','Moderate-Low','Moderate','Moderate-High','Active','Aggressive','Very Aggressive','Max Aggressive'];
  momentumRisks.forEach((risk, i) => {
    strategies.push({
      name: 'Momentum ' + momentumNames[i],
      type: 'MOMENTUM',
      risk,
      description: 'Buy on strong uptrend + high confidence signal. Exit on signal flip or stop loss.',
      rules: {
        minSignalConfidence: 85 - (risk * 3),
        positionSizeMaxPct: 5 + (risk * 2),
        stopLossPct: 15 - (risk * 0.8),
        takeProfitPct: 10 + (risk * 3.5),
        requireVolumeConfirmation: risk < 6,
        requireUptrend: risk < 8,
        maxPositions: 5 + risk,
        rebalanceOnSignalFlip: risk > 6
      }
    });
  });

  const mrRisks = [2,3,4,5,5,6,7,7,8,9];
  const mrNames = ['Ultra Safe','Safe','Cautious','Moderate-Low','Moderate A','Moderate B','Active A','Active B','Aggressive','Max'];
  mrRisks.forEach((risk, i) => {
    strategies.push({
      name: 'Mean Reversion ' + mrNames[i],
      type: 'MEAN_REVERSION',
      risk,
      description: 'Buy oversold (low RSI + below Bollinger). Sell when RSI recovers.',
      rules: {
        buyRsiMax: 40 - (risk * 1.5),
        sellRsiMin: 55 + (risk * 1.5),
        requireBollingerConfirmation: risk < 6,
        positionSizeMaxPct: 4 + (risk * 2),
        stopLossPct: 12 - (risk * 0.5),
        maxPositions: 4 + risk
      }
    });
  });

  const sigRisks = [2,3,4,5,6,6,7,7,8,9];
  const confThresholds = [88,84,80,76,72,68,65,62,58,55];
  sigRisks.forEach((risk, i) => {
    strategies.push({
      name: 'Signals ' + confThresholds[i] + '% Confidence',
      type: 'SIGNALS_ONLY',
      risk,
      description: 'Follow decision engine signals above confidence threshold. No extra filters.',
      rules: {
        minConfidence: confThresholds[i],
        exitOnSell: true,
        positionSizeMaxPct: 4 + (risk * 2),
        stopLossPct: 10 - (risk * 0.3),
        maxPositions: 5 + risk
      }
    });
  });

  const earningsCfgs = [
    { risk:3, days:10, beatMin:75, prob:72 },
    { risk:4, days:9, beatMin:73, prob:70 },
    { risk:5, days:8, beatMin:72, prob:68 },
    { risk:6, days:7, beatMin:70, prob:66 },
    { risk:7, days:6, beatMin:68, prob:64 },
    { risk:8, days:5, beatMin:65, prob:62 },
    { risk:8, days:4, beatMin:62, prob:60 },
    { risk:9, days:3, beatMin:60, prob:58 }
  ];
  earningsCfgs.forEach((cfg, i) => {
    strategies.push({
      name: 'Earnings Play ' + (i+1),
      type: 'EARNINGS',
      risk: cfg.risk,
      description: 'Enter ' + cfg.days + 'd before earnings. Exit 1-2d after. Requires beat history.',
      rules: {
        buyDaysBeforeEarnings: cfg.days,
        sellDaysAfterEarnings: 2,
        minBeatRate: cfg.beatMin,
        minAiBeatProbability: cfg.prob,
        positionSizeMaxPct: 8 + cfg.risk,
        stopLossPct: 12,
        maxPositions: 5
      }
    });
  });

  [2,3,4,5,6,7,9].forEach((risk, i) => {
    strategies.push({
      name: 'Trend Following Risk ' + risk,
      type: 'TREND_FOLLOWING',
      risk,
      description: 'Enter on confirmed trend + golden cross. Hold until trend breaks.',
      rules: {
        requireAboveBothMAs: risk < 5,
        requireAbove50MA: risk >= 5,
        requireGoldenCross: risk < 4,
        requireVolumeConfirmation: risk < 6,
        minTrend: risk < 5 ? 'STRONG_UPTREND' : 'UPTREND',
        positionSizeMaxPct: 5 + (risk * 2),
        stopLossPct: 14 - risk,
        maxPositions: 4 + risk
      }
    });
  });

  [3,4,5,6,7].forEach((risk, i) => {
    strategies.push({
      name: 'Value Quality Risk ' + risk,
      type: 'VALUE',
      risk,
      description: 'Buy quality stocks at discount. Analyst buy + low RSI + reasonable PE.',
      rules: {
        maxPE: 25 - (risk * 1.5),
        minRevenueGrowth: 8 + (5-i),
        maxRSIEntry: 48 + (risk * 2),
        requireAnalystBuy: risk < 7,
        positionSizeMaxPct: 6 + (risk * 2),
        stopLossPct: 10,
        maxPositions: 6 + risk
      }
    });
  });

  console.log('PAPER: generated', strategies.length, 'strategies');
  if (strategies.length !== 50) console.warn('WARNING: expected 50 strategies, got', strategies.length);
  return strategies;
}

const STRATEGIES = generateStrategies();

async function initPaperPortfolios() {
  const existing = await query('SELECT COUNT(*) as count FROM paper_portfolios');
  if (parseInt(existing.rows[0].count) >= 50) {
    console.log('PAPER: already have', existing.rows[0].count, 'portfolios');
    return { skipped: true, count: existing.rows[0].count };
  }

  let realPositions = [];
  let realCash = 0;

  try {
    const t212 = require('./t212');
    if (t212.fetchT212Positions) {
      realPositions = await t212.fetchT212Positions();
    }
    if (t212.fetchT212Cash) {
      const cashData = await t212.fetchT212Cash();
      realCash = cashData && (cashData.free || cashData.cash || 0);
    }
  } catch(e) {
    console.log('PAPER: T212 unavailable, using DB positions:', e.message);
  }

  if (!realPositions || !realPositions.length) {
    try {
      const rows = await query('SELECT * FROM portfolio_positions WHERE quantity > 0');
      realPositions = rows.rows.map(r => ({
        ticker: r.ticker,
        company: r.company || r.ticker,
        quantity: parseFloat(r.quantity) || 0,
        currentPrice: parseFloat(r.current_price) || 0,
        avgCost: parseFloat(r.avg_cost) || 0,
        currentValue: parseFloat(r.current_value) || 0
      })).filter(p => p.quantity > 0 && p.ticker);
    } catch(e) {
      console.log('PAPER: portfolio_positions fallback failed:', e.message);
    }
  }

  if (!realPositions || !realPositions.length) {
    try {
      const rows = await query('SELECT * FROM positions WHERE quantity > 0');
      realPositions = rows.rows.map(r => ({
        ticker: r.ticker,
        company: r.ticker,
        quantity: parseFloat(r.quantity) || 0,
        currentPrice: parseFloat(r.current_price) || 0,
        avgCost: parseFloat(r.avg_price) || 0,
        currentValue: parseFloat(r.market_value) || 0
      })).filter(p => p.quantity > 0 && p.ticker);
    } catch(e) {
      console.log('PAPER: positions fallback failed:', e.message);
    }
  }

  if (!realPositions || !realPositions.length) {
    console.log('PAPER: no positions found - seeding with demo data');
    realPositions = [
      { ticker:'NVDA', company:'NVIDIA Corp', quantity:10, currentPrice:850, avgCost:600, currentValue:8500 },
      { ticker:'PLTR', company:'Palantir Technologies', quantity:100, currentPrice:22, avgCost:18, currentValue:2200 },
      { ticker:'MSFT', company:'Microsoft Corp', quantity:5, currentPrice:420, avgCost:380, currentValue:2100 },
      { ticker:'AAPL', company:'Apple Inc', quantity:15, currentPrice:195, avgCost:170, currentValue:2925 },
      { ticker:'TSLA', company:'Tesla Inc', quantity:8, currentPrice:240, avgCost:200, currentValue:1920 }
    ];
  }

  let totalValue = realPositions.reduce((s,p) => s + (p.currentValue || (p.currentPrice || p.avgCost || 100) * p.quantity), 0) + realCash;
  if (totalValue < 100) totalValue = 10000;

  console.log('PAPER: initialising 50 portfolios. Real value: £'+totalValue.toFixed(2)+', positions:', realPositions.length);

  let created = 0;
  for (const strategy of STRATEGIES) {
    try {
      const res = await query(
        'INSERT INTO paper_portfolios (name, strategy_type, risk_level, starting_value, current_value, cash, description, rules) VALUES ($1,$2,$3,$4,$4,$5,$6,$7) RETURNING id',
        [strategy.name, strategy.type, strategy.risk, totalValue, realCash, strategy.description, JSON.stringify(strategy.rules)]
      );
      const portfolioId = res.rows[0].id;

      for (const pos of realPositions) {
        if (!pos.ticker || pos.quantity <= 0) continue;
        const price = pos.currentPrice || pos.avgCost || 100;
        const value = price * pos.quantity;
        await query(
          'INSERT INTO paper_positions (portfolio_id, ticker, company, quantity, avg_cost, current_price, current_value) VALUES ($1,$2,$3,$4,$5,$5,$6) ON CONFLICT(portfolio_id,ticker) DO NOTHING',
          [portfolioId, pos.ticker, pos.company || pos.ticker, pos.quantity, price, value]
        );
      }

      await query(
        'INSERT INTO paper_snapshots (portfolio_id, total_value, cash, return_pct) VALUES ($1,$2,$3,0) ON CONFLICT(portfolio_id, snapshot_date) DO NOTHING',
        [portfolioId, totalValue, realCash]
      );

      created++;
      if (created % 10 === 0) console.log('PAPER: created', created, '/ 50 portfolios');
    } catch(e) {
      console.log('PAPER INIT ERROR for', strategy.name, ':', e.message);
    }
  }

  console.log('PAPER: initialisation complete. Created', created, 'portfolios.');
  return { created, totalValue, positions: realPositions.length };
}

async function executeStrategy(portfolio, positions, quote, signal, ta) {
  if (!quote || !quote.price || !signal) return { action: 'HOLD', reason: 'missing data' };

  const rules = portfolio.rules || {};
  const currentPrice = parseFloat(quote.price);
  if (!currentPrice || currentPrice <= 0) return { action: 'HOLD', reason: 'invalid price' };

  const portfolioValue = positions.reduce((s,p) => s + parseFloat(p.current_value||0), 0) + parseFloat(portfolio.cash||0);
  const maxPositionValue = portfolioValue * ((rules.positionSizeMaxPct || 10) / 100);
  const existingPos = positions.find(p => p.ticker === signal.ticker);
  const currentPositionCount = positions.filter(p => parseFloat(p.quantity||0) > 0).length;
  const maxPositions = rules.maxPositions || 10;
  const availableCash = parseFloat(portfolio.cash || 0);

  if (!existingPos && currentPositionCount < maxPositions && availableCash >= maxPositionValue * 0.5) {
    let shouldBuy = false;
    let buyReason = '';
    const conf = signal.confidence || 50;
    const trend = ta ? (ta.trend || 'NEUTRAL') : 'NEUTRAL';
    const rsi = parseFloat(ta ? (ta.rsi_14 || 50) : 50);
    const volRatio = parseFloat(ta ? (ta.volume_ratio || 1) : 1);

    switch(portfolio.strategy_type) {
      case 'MOMENTUM':
        shouldBuy = conf >= (rules.minSignalConfidence||70)
          && signal.signal && signal.signal.includes('BUY')
          && (!rules.requireUptrend || trend.includes('UP'))
          && (!rules.requireVolumeConfirmation || volRatio > 1.3);
        buyReason = 'Momentum: conf='+conf+'% trend='+trend+' vol='+volRatio.toFixed(1)+'x';
        break;
      case 'MEAN_REVERSION':
        shouldBuy = rsi <= (rules.buyRsiMax||35)
          && (!rules.requireBollingerConfirmation || (ta && ta.bollinger_position === 'BELOW_LOWER'));
        buyReason = 'Mean reversion: RSI='+rsi.toFixed(0);
        break;
      case 'SIGNALS_ONLY':
        shouldBuy = conf >= (rules.minConfidence||70) && signal.signal && signal.signal.includes('BUY');
        buyReason = 'Signal: '+(signal.signal||'UNKNOWN')+' '+conf+'% confidence';
        break;
      case 'VALUE': {
        const pe = parseFloat((ta && ta.pe_ratio) || (signal && signal.pe) || 999);
        shouldBuy = pe <= (rules.maxPE||20) && conf >= 55 && rsi <= (rules.maxRSIEntry||50);
        buyReason = 'Value: PE='+pe.toFixed(1)+' RSI='+rsi.toFixed(0);
        break;
      }
      case 'EARNINGS': {
        const daysToEarnings = signal.daysToEarnings || 999;
        const beatProb = signal.beatProbability || 50;
        shouldBuy = daysToEarnings > 0 && daysToEarnings <= (rules.buyDaysBeforeEarnings||7)
          && beatProb >= (rules.minAiBeatProbability||65);
        buyReason = 'Earnings: '+daysToEarnings+'d away beatProb='+beatProb+'%';
        break;
      }
      case 'TREND_FOLLOWING':
        shouldBuy = (!rules.requireAboveBothMAs || trend === 'STRONG_UPTREND')
          && (!rules.requireAbove50MA || trend.includes('UP'))
          && (!rules.requireGoldenCross || (ta && ta.golden_cross))
          && signal.signal && signal.signal.includes('BUY');
        buyReason = 'Trend: '+trend+(ta && ta.golden_cross?' GoldenCross':'');
        break;
    }

    if (shouldBuy) {
      const quantity = parseFloat((maxPositionValue / currentPrice).toFixed(4));
      const cost = parseFloat((quantity * currentPrice).toFixed(2));
      if (quantity > 0 && cost > 0 && availableCash >= cost) {
        return { action: 'BUY', quantity, cost, price: currentPrice, reason: buyReason };
      }
    }
  }

  if (existingPos) {
    const avgCost = parseFloat(existingPos.avg_cost || currentPrice);
    const pnlPct = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;
    let shouldSell = false;
    let sellReason = '';

    if (pnlPct <= -(rules.stopLossPct || 10)) {
      shouldSell = true;
      sellReason = 'STOP LOSS: ' + pnlPct.toFixed(1) + '%';
    }
    if (rules.takeProfitPct && pnlPct >= rules.takeProfitPct) {
      shouldSell = true;
      sellReason = 'TAKE PROFIT: +' + pnlPct.toFixed(1) + '%';
    }

    if (!shouldSell) {
      const rsi = parseFloat(ta ? (ta.rsi_14 || 50) : 50);
      switch(portfolio.strategy_type) {
        case 'MEAN_REVERSION':
          if (rsi >= (rules.sellRsiMin||65)) { shouldSell=true; sellReason='RSI recovered to '+rsi.toFixed(0); }
          break;
        case 'SIGNALS_ONLY':
          if (rules.exitOnSell && signal.signal && signal.signal.includes('SELL')) { shouldSell=true; sellReason='Signal turned '+signal.signal+' '+signal.confidence+'%'; }
          break;
        case 'MOMENTUM':
          if (rules.rebalanceOnSignalFlip && signal.signal && signal.signal.includes('SELL') && signal.confidence > 65) { shouldSell=true; sellReason='Momentum reversed '+signal.signal; }
          break;
        case 'TREND_FOLLOWING':
          if (ta && (ta.trend === 'STRONG_DOWNTREND' || ta.death_cross)) { shouldSell=true; sellReason='Trend broken: '+ta.trend; }
          break;
      }
    }

    if (shouldSell) {
      const qty = parseFloat(existingPos.quantity || 0);
      const proceeds = parseFloat((qty * currentPrice).toFixed(2));
      const pnl = parseFloat(((currentPrice - avgCost) * qty).toFixed(2));
      return { action: 'SELL', quantity: qty, proceeds, price: currentPrice, pnl, pnlPct, reason: sellReason };
    }
  }

  return { action: 'HOLD', reason: 'no trigger' };
}

async function executePaperTrade(portfolioId, ticker, decision) {
  const client = pool ? await pool.connect() : null;
  if (!client) {
    console.log('PAPER: no DB pool available');
    return;
  }
  try {
    await client.query('BEGIN');

    await client.query(
      'INSERT INTO paper_trades (portfolio_id,ticker,action,quantity,price,total_value,signal_confidence,reason,pnl) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [portfolioId, ticker, decision.action, decision.quantity, decision.price,
        decision.action==='BUY' ? decision.cost : decision.proceeds,
        decision.confidence||null, decision.reason, decision.pnl||0]
    );

    if (decision.action === 'BUY') {
      await client.query(
        'UPDATE paper_portfolios SET cash=cash-$1, total_trades=total_trades+1 WHERE id=$2',
        [decision.cost, portfolioId]
      );
      await client.query(
        'INSERT INTO paper_positions (portfolio_id,ticker,quantity,avg_cost,current_price,current_value) VALUES ($1,$2,$3,$4,$4,$5) ON CONFLICT(portfolio_id,ticker) DO UPDATE SET quantity=paper_positions.quantity+$3, avg_cost=($4+paper_positions.avg_cost)/2, current_price=$4, current_value=(paper_positions.quantity+$3)*$4',
        [portfolioId, ticker, decision.quantity, decision.price, decision.cost]
      );
    } else {
      const isWin = (decision.pnl || 0) > 0;
      await client.query(
        'UPDATE paper_portfolios SET cash=cash+$1, total_trades=total_trades+1, winning_trades=winning_trades+$2 WHERE id=$3',
        [decision.proceeds, isWin ? 1 : 0, portfolioId]
      );
      await client.query('DELETE FROM paper_positions WHERE portfolio_id=$1 AND ticker=$2', [portfolioId, ticker]);
    }

    await client.query('COMMIT');
  } catch(e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function runDailySimulation(options) {
  options = options || {};
  console.log('PAPER SIM: starting daily simulation');

  const portfolios = await query('SELECT * FROM paper_portfolios ORDER BY id');
  if (!portfolios.rows.length) {
    console.log('PAPER SIM: no portfolios - running init first');
    await initPaperPortfolios();
    return runDailySimulation(options);
  }

  const tickerRows = await query('SELECT DISTINCT ticker FROM paper_positions WHERE quantity > 0');
  const tickers = tickerRows.rows.map(r => r.ticker).filter(Boolean);
  console.log('PAPER SIM:', portfolios.rows.length, 'portfolios,', tickers.length, 'unique tickers');

  const marketData = {};
  for (const ticker of tickers) {
    try {
      let quote = null;
      let ta = null;
      let signal = null;

      try {
        const mdf = require('./marketDataFetcher');
        if (mdf.fetchLiveQuote) quote = await mdf.fetchLiveQuote(ticker);
      } catch(e) { /* ignore */ }

      try {
        const taRow = await query('SELECT * FROM technical_analysis WHERE ticker=$1', [ticker]);
        ta = taRow.rows[0] || null;
      } catch(e) { /* ignore */ }

      try {
        const de = require('./decisionEngine');
        if (de.generateMasterSignal) signal = await de.generateMasterSignal(ticker);
      } catch(e) { /* ignore */ }

      if (!signal) {
        const rsi = parseFloat(ta ? (ta.rsi_14 || 50) : 50);
        const techScore = parseInt(ta ? (ta.technical_score || 50) : 50);
        signal = {
          ticker,
          signal: techScore >= 65 ? 'BUY' : techScore >= 45 ? 'HOLD' : 'SELL',
          confidence: techScore,
          beatProbability: 50,
          daysToEarnings: 999
        };
      }

      if (!quote || !quote.price) {
        try {
          const posRow = await query('SELECT current_price FROM portfolio_positions WHERE ticker=$1 LIMIT 1', [ticker]);
          if (posRow.rows[0]) quote = { price: posRow.rows[0].current_price };
        } catch(e) { /* ignore */ }
      }

      if (!quote || !quote.price) {
        try {
          const posRow = await query('SELECT current_price FROM positions WHERE ticker=$1 LIMIT 1', [ticker]);
          if (posRow.rows[0]) quote = { price: posRow.rows[0].current_price };
        } catch(e) { /* ignore */ }
      }

      if (!quote || !quote.price) {
        try {
          const posRow = await query('SELECT current_price FROM paper_positions WHERE ticker=$1 LIMIT 1', [ticker]);
          if (posRow.rows[0]) quote = { price: posRow.rows[0].current_price };
        } catch(e) { /* ignore */ }
      }

      try {
        const earningsRow = await query(
          'SELECT * FROM earnings_calendar WHERE ticker=$1 AND report_date>=CURRENT_DATE ORDER BY report_date ASC LIMIT 1',
          [ticker]
        );
        if (earningsRow.rows[0]) {
          const daysToEarnings = Math.ceil((new Date(earningsRow.rows[0].report_date) - new Date()) / 86400000);
          signal.daysToEarnings = daysToEarnings;
          signal.beatProbability = earningsRow.rows[0].ai_beat_probability || 50;
        }
      } catch(e) { /* ignore */ }

      marketData[ticker] = { quote, ta, signal };
      await new Promise(r => setTimeout(r, 50));
    } catch(e) {
      console.log('PAPER SIM: data fetch failed for', ticker, e.message);
    }
  }

  let totalTrades = 0;
  for (const portfolio of portfolios.rows) {
    const positions = await query('SELECT * FROM paper_positions WHERE portfolio_id=$1 AND quantity>0', [portfolio.id]);

    for (const pos of positions.rows) {
      const md = marketData[pos.ticker];
      if (!md || !md.quote || !md.quote.price) continue;
      const newPrice = parseFloat(md.quote.price);
      if (newPrice <= 0) continue;
      const newValue = parseFloat((newPrice * pos.quantity).toFixed(2));
      const avgCost = parseFloat(pos.avg_cost || newPrice);
      const pnlPct = avgCost > 0 ? ((newPrice - avgCost) / avgCost * 100) : 0;
      await query(
        'UPDATE paper_positions SET current_price=$1, current_value=$2, unrealised_pnl=$3, unrealised_pnl_pct=$4, last_updated=NOW() WHERE portfolio_id=$5 AND ticker=$6',
        [newPrice, newValue, (newValue - avgCost * pos.quantity).toFixed(2), pnlPct.toFixed(2), portfolio.id, pos.ticker]
      );
    }

    const freshPositions = await query('SELECT * FROM paper_positions WHERE portfolio_id=$1 AND quantity>0', [portfolio.id]);
    const freshPortfolioRow = await query('SELECT * FROM paper_portfolios WHERE id=$1', [portfolio.id]);
    const freshPortfolio = freshPortfolioRow.rows[0] || portfolio;

    for (const ticker of tickers) {
      const md = marketData[ticker];
      if (!md || !md.quote || !md.quote.price || !md.signal) continue;

      try {
        const decision = await executeStrategy(freshPortfolio, freshPositions.rows, md.quote, md.signal, md.ta);
        if (decision.action !== 'HOLD') {
          await executePaperTrade(portfolio.id, ticker, Object.assign({}, decision, { confidence: md.signal.confidence }));
          totalTrades++;
          console.log('PAPER TRADE:', freshPortfolio.name, decision.action, ticker, '@'+decision.price, decision.reason);
        }
      } catch(e) {
        console.log('PAPER SIM: trade error', portfolio.name, ticker, e.message);
      }
    }

    try {
      const totals = await query('SELECT SUM(current_value) as invested FROM paper_positions WHERE portfolio_id=$1 AND quantity>0', [portfolio.id]);
      const invested = parseFloat(totals.rows[0] ? (totals.rows[0].invested || 0) : 0);
      const latestPortfolio = await query('SELECT cash, starting_value FROM paper_portfolios WHERE id=$1', [portfolio.id]);
      const cash = parseFloat(latestPortfolio.rows[0] ? (latestPortfolio.rows[0].cash || 0) : 0);
      const startValue = parseFloat(latestPortfolio.rows[0] ? (latestPortfolio.rows[0].starting_value || 1) : 1);
      const totalValue = invested + cash;
      const returnPct = startValue > 0 ? ((totalValue - startValue) / startValue * 100) : 0;

      const yesterday = await query(
        'SELECT total_value FROM paper_snapshots WHERE portfolio_id=$1 AND snapshot_date=CURRENT_DATE-1',
        [portfolio.id]
      );
      const dailyChange = yesterday.rows[0] && yesterday.rows[0].total_value > 0
        ? ((totalValue - yesterday.rows[0].total_value) / yesterday.rows[0].total_value * 100)
        : 0;

      await query(
        'UPDATE paper_portfolios SET current_value=$1, total_return_pct=$2, last_updated=NOW() WHERE id=$3',
        [totalValue.toFixed(2), returnPct.toFixed(4), portfolio.id]
      );

      await query(
        'INSERT INTO paper_snapshots (portfolio_id, total_value, cash, return_pct, daily_change_pct) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(portfolio_id, snapshot_date) DO UPDATE SET total_value=$2, return_pct=$4, daily_change_pct=$5',
        [portfolio.id, totalValue.toFixed(2), cash.toFixed(2), returnPct.toFixed(4), dailyChange.toFixed(4)]
      );
    } catch(e) {
      console.log('PAPER SIM: totals error for portfolio', portfolio.id, e.message);
    }
  }

  console.log('PAPER SIM: complete. Trades executed:', totalTrades);
  return { portfoliosUpdated: portfolios.rows.length, tradesExecuted: totalTrades };
}

module.exports = { initPaperPortfolios, runDailySimulation, executeStrategy, STRATEGIES };
