const { query } = require('../models/db');
const { getFullStockData } = require('./batchCallOptimizer');
const { getMacroContext } = require('./macroService');
const cache = require('./cache');

const CACHE_TTL = 1800; // 30 min

function formatMoney(n) {
  if (!n) return 'N/A';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + n.toFixed(0);
}

async function generateMasterSignal(ticker, forceRefresh = false) {
  const ck = 'decision:' + ticker;
  if (!forceRefresh) {
    const c = await cache.get(ck).catch(() => null);
    if (c) { try { return JSON.parse(c); } catch {} }
  }

  const [taR, earningsR, stockR, congressR, insiderR, macroR] = await Promise.allSettled([
    query('SELECT * FROM technical_analysis WHERE ticker=$1', [ticker]),
    query('SELECT * FROM earnings_calendar WHERE UPPER(ticker)=UPPER($1) ORDER BY report_date DESC LIMIT 6', [ticker]),
    getFullStockData(ticker),
    query('SELECT * FROM congress_trades WHERE UPPER(ticker)=UPPER($1) ORDER BY transaction_date DESC LIMIT 10', [ticker]),
    query('SELECT * FROM insider_trades WHERE UPPER(ticker)=UPPER($1) ORDER BY trade_date DESC LIMIT 10', [ticker]),
    getMacroContext(),
  ]);

  const tech = taR.status === 'fulfilled' ? taR.value?.rows?.[0] : null;
  const earningRows = earningsR.status === 'fulfilled' ? earningsR.value?.rows || [] : [];
  const stock = stockR.status === 'fulfilled' ? stockR.value : null;
  const congress = congressR.status === 'fulfilled' ? congressR.value?.rows || [] : [];
  const insiders = insiderR.status === 'fulfilled' ? insiderR.value?.rows || [] : [];
  const macro = macroR.status === 'fulfilled' ? macroR.value : null;

  const evidence = [];

  // TECHNICAL EVIDENCE (max 40 pts)
  if (tech) {
    const rsi = tech.rsi_14 ? parseFloat(tech.rsi_14) : null;
    const volRatio = tech.volume_ratio ? parseFloat(tech.volume_ratio) : null;
    const support = tech.nearest_support ? parseFloat(tech.nearest_support) : null;
    const resistance = tech.nearest_resistance ? parseFloat(tech.nearest_resistance) : null;
    const distSupPct = tech.distance_to_support_pct ? parseFloat(tech.distance_to_support_pct) : null;
    const distResPct = tech.distance_to_resistance_pct ? parseFloat(tech.distance_to_resistance_pct) : null;
    const atrPct = tech.atr_pct ? parseFloat(tech.atr_pct) : null;

    if (tech.trend === 'STRONG_UPTREND') evidence.push({ type: 'TECHNICAL', weight: 10, direction: 1, fact: 'Price above both 50MA and 200MA — confirmed uptrend' });
    if (tech.trend === 'STRONG_DOWNTREND') evidence.push({ type: 'TECHNICAL', weight: 10, direction: -1, fact: 'Price below both MAs — confirmed downtrend' });
    if (tech.trend === 'UPTREND') evidence.push({ type: 'TECHNICAL', weight: 5, direction: 1, fact: 'Price above 50MA — uptrend in place' });
    if (tech.trend === 'DOWNTREND') evidence.push({ type: 'TECHNICAL', weight: 5, direction: -1, fact: 'Price below 50MA — downtrend in place' });
    if (tech.golden_cross) evidence.push({ type: 'TECHNICAL', weight: 8, direction: 1, fact: 'Golden cross active: 50MA crossed above 200MA' });
    if (tech.death_cross) evidence.push({ type: 'TECHNICAL', weight: 8, direction: -1, fact: 'Death cross active: 50MA crossed below 200MA' });
    if (rsi !== null && rsi < 30) evidence.push({ type: 'TECHNICAL', weight: 7, direction: 1, fact: `RSI ${rsi.toFixed(0)} — oversold, historically strong bounce zone` });
    if (rsi !== null && rsi > 70) evidence.push({ type: 'TECHNICAL', weight: 7, direction: -1, fact: `RSI ${rsi.toFixed(0)} — overbought, elevated pullback risk` });
    if (rsi !== null && rsi >= 30 && rsi <= 50) evidence.push({ type: 'TECHNICAL', weight: 3, direction: 1, fact: `RSI ${rsi.toFixed(0)} — neutral/recovering, room to run` });
    if (tech.macd_trend === 'BULLISH' && tech.trend?.includes('UP')) evidence.push({ type: 'TECHNICAL', weight: 5, direction: 1, fact: 'MACD bullish crossover with uptrend confirmation' });
    if (tech.macd_trend === 'BEARISH' && tech.trend?.includes('DOWN')) evidence.push({ type: 'TECHNICAL', weight: 5, direction: -1, fact: 'MACD bearish with downtrend confirmation' });
    if (tech.bollinger_position === 'BELOW_LOWER') evidence.push({ type: 'TECHNICAL', weight: 5, direction: 1, fact: 'Price below Bollinger lower band — mean reversion opportunity' });
    if (tech.bollinger_position === 'ABOVE_UPPER') evidence.push({ type: 'TECHNICAL', weight: 5, direction: -1, fact: 'Price above Bollinger upper band — stretched, pullback risk' });
    if (volRatio !== null && volRatio > 1.8 && tech.trend?.includes('UP')) evidence.push({ type: 'TECHNICAL', weight: 5, direction: 1, fact: `Volume ${volRatio.toFixed(1)}x average confirming upward move` });
    if (distSupPct !== null && distSupPct < 2 && support) evidence.push({ type: 'TECHNICAL', weight: 4, direction: 1, fact: `Within ${distSupPct.toFixed(1)}% of key support at $${support.toFixed(2)}` });
    if (distResPct !== null && distResPct < 2 && resistance) evidence.push({ type: 'TECHNICAL', weight: 4, direction: -1, fact: `Within ${distResPct.toFixed(1)}% of key resistance at $${resistance.toFixed(2)}` });
  }

  // FUNDAMENTAL EVIDENCE (max 30 pts)
  if (stock?.analyst) {
    const a = stock.analyst;
    const total = (a.strongBuy || 0) + (a.buy || 0) + (a.hold || 0) + (a.sell || 0) + (a.strongSell || 0);
    const bulls = (a.strongBuy || 0) + (a.buy || 0);
    const bullPct = total > 0 ? bulls / total * 100 : 0;
    const price = stock.price?.price;
    const upside = a.targetPrice && price ? (a.targetPrice - price) / price * 100 : null;

    if (bullPct > 70 && total >= 3) evidence.push({ type: 'FUNDAMENTAL', weight: 8, direction: 1, fact: `${Math.round(bullPct)}% of ${total} analysts rate BUY, consensus target $${(a.targetPrice || 0).toFixed(2)}` });
    if (bullPct < 30 && total >= 3) evidence.push({ type: 'FUNDAMENTAL', weight: 8, direction: -1, fact: `Only ${Math.round(bullPct)}% of ${total} analysts bullish — majority HOLD or SELL` });
    if (upside !== null && upside > 15) evidence.push({ type: 'FUNDAMENTAL', weight: 7, direction: 1, fact: `Analyst consensus implies ${upside.toFixed(0)}% upside to $${(a.targetPrice || 0).toFixed(2)}` });
    if (upside !== null && upside < -10) evidence.push({ type: 'FUNDAMENTAL', weight: 7, direction: -1, fact: `Stock trading ${Math.abs(upside).toFixed(0)}% above analyst consensus target` });
    if (upside !== null && upside > 5 && upside <= 15) evidence.push({ type: 'FUNDAMENTAL', weight: 4, direction: 1, fact: `${upside.toFixed(0)}% upside to analyst target $${(a.targetPrice || 0).toFixed(2)}` });

    const gradeScore = { strongbuy: 5, buy: 4, hold: 3, underperform: 2, sell: 1, outperform: 4, neutral: 3, underweight: 2, overweight: 4 };
    const upgrades = (a.recentUpgrades || []).filter(u => {
      const to = (gradeScore[u.toGrade?.toLowerCase()] || 3);
      const from = (gradeScore[u.fromGrade?.toLowerCase()] || 3);
      return to > from;
    });
    const downgrades = (a.recentUpgrades || []).filter(u => {
      const to = (gradeScore[u.toGrade?.toLowerCase()] || 3);
      const from = (gradeScore[u.fromGrade?.toLowerCase()] || 3);
      return to < from;
    });
    if (upgrades.length >= 2) evidence.push({ type: 'FUNDAMENTAL', weight: 6, direction: 1, fact: `${upgrades.length} analyst upgrades recently: ${upgrades.slice(0, 2).map(u => u.firm).join(', ')}` });
    if (downgrades.length >= 2) evidence.push({ type: 'FUNDAMENTAL', weight: 6, direction: -1, fact: `${downgrades.length} analyst downgrades recently: ${downgrades.slice(0, 2).map(u => u.firm).join(', ')}` });
  }

  // EARNINGS EVIDENCE (max 20 pts)
  if (earningRows.length > 0) {
    const reported = earningRows.filter(e => e.eps_actual != null);
    const beats = reported.filter(e => parseFloat(e.eps_actual) > parseFloat(e.eps_estimate)).length;
    const beatRate = reported.length > 0 ? beats / reported.length * 100 : 0;

    if (reported.length >= 2) {
      if (beatRate >= 75) evidence.push({ type: 'EARNINGS', weight: 6, direction: 1, fact: `Beat EPS estimates ${beats}/${reported.length} last quarters (${Math.round(beatRate)}% beat rate)` });
      if (beatRate < 40) evidence.push({ type: 'EARNINGS', weight: 6, direction: -1, fact: `Only ${Math.round(beatRate)}% EPS beat rate — inconsistent delivery` });
    }

    const last = reported[0];
    if (last?.eps_surprise_pct) {
      const sp = parseFloat(last.eps_surprise_pct);
      if (sp > 10) evidence.push({ type: 'EARNINGS', weight: 5, direction: 1, fact: `Last quarter beat by ${sp.toFixed(1)}% ($${parseFloat(last.eps_actual).toFixed(2)} vs $${parseFloat(last.eps_estimate).toFixed(2)} est)` });
      if (sp < -10) evidence.push({ type: 'EARNINGS', weight: 5, direction: -1, fact: `Last quarter missed by ${Math.abs(sp).toFixed(1)}%` });
    }

    const upcoming = earningRows.find(e => e.eps_actual == null && new Date(e.report_date) >= new Date());
    if (upcoming) {
      const days = Math.ceil((new Date(upcoming.report_date) - new Date()) / 86400000);
      if (days <= 7) evidence.push({ type: 'EARNINGS', weight: 0, direction: 0, fact: `CATALYST: Earnings in ${days} day${days === 1 ? '' : 's'} — expect high volatility` });
      if (upcoming.ai_beat_probability > 70) evidence.push({ type: 'EARNINGS', weight: 4, direction: 1, fact: `AI model estimates ${upcoming.ai_beat_probability}% probability of earnings beat` });
    }
  }

  // CONGRESSIONAL EVIDENCE (max 15 pts)
  const cutoff30 = new Date(Date.now() - 30 * 86400000);
  const cutoff60 = new Date(Date.now() - 60 * 86400000);
  const congressBuys = congress.filter(t => t.transaction_type?.toLowerCase().includes('purchase') && new Date(t.transaction_date) > cutoff30);
  const congressSells = congress.filter(t => t.transaction_type?.toLowerCase().includes('sale') && new Date(t.transaction_date) > cutoff30);
  if (congressBuys.length >= 2) evidence.push({ type: 'CONGRESS', weight: 7, direction: 1, fact: `${congressBuys.length} Congress members bought in last 30 days: ${congressBuys.slice(0, 2).map(t => t.member_name?.split(' ').pop()).join(', ')}` });
  else if (congressBuys.length === 1) evidence.push({ type: 'CONGRESS', weight: 4, direction: 1, fact: `${congressBuys[0].member_name} purchased recently` });
  if (congressSells.length >= 2) evidence.push({ type: 'CONGRESS', weight: 5, direction: -1, fact: `${congressSells.length} Congress members sold in last 30 days` });

  // INSIDER EVIDENCE (max 15 pts)
  const insiderBuys = insiders.filter(t => t.trade_type === 'P' && new Date(t.trade_date) > cutoff60);
  const insiderSells = insiders.filter(t => t.trade_type === 'S' && new Date(t.trade_date) > cutoff60);
  if (insiderBuys.length >= 1) {
    const totalVal = insiderBuys.reduce((s, i) => s + (parseFloat(i.value) || 0), 0);
    evidence.push({ type: 'INSIDER', weight: 8, direction: 1, fact: `${insiderBuys.length} insider purchase${insiderBuys.length > 1 ? 's' : ''}: ${formatMoney(totalVal)} — ${insiderBuys.slice(0, 2).map(i => i.insider_name?.split(' ').pop()).join(', ')}` });
  }
  if (insiderSells.length >= 3) {
    const totalVal = insiderSells.reduce((s, i) => s + (parseFloat(i.value) || 0), 0);
    evidence.push({ type: 'INSIDER', weight: 5, direction: -1, fact: `${insiderSells.length} insider sales: ${formatMoney(totalVal)} in last 60 days` });
  }

  // MACRO MODIFIER
  if (macro?.vix?.value > 30) evidence.push({ type: 'MACRO', weight: 3, direction: 1, fact: `VIX ${macro.vix.value.toFixed(0)} elevated — fear often creates buying opportunity in quality names` });
  if (macro?.fearGreed?.score < 25) evidence.push({ type: 'MACRO', weight: 3, direction: 1, fact: `Fear & Greed ${macro.fearGreed.score}/100 (Extreme Fear) — historically strong buy zone` });
  if (macro?.fearGreed?.score > 80) evidence.push({ type: 'MACRO', weight: 2, direction: -1, fact: `Fear & Greed ${macro.fearGreed.score}/100 (Extreme Greed) — elevated market risk` });

  // SCORE CALCULATION
  const bullScore = evidence.filter(e => e.direction === 1).reduce((s, e) => s + e.weight, 0);
  const bearScore = evidence.filter(e => e.direction === -1).reduce((s, e) => s + e.weight, 0);
  const catalysts = evidence.filter(e => e.direction === 0);
  const maxPossible = 85;
  const netScore = bullScore - bearScore;
  const confidence = Math.min(95, Math.max(5, Math.round(50 + (netScore / maxPossible) * 50)));

  let signal, action;
  if (confidence >= 72) { signal = 'STRONG BUY'; action = 'Consider adding to position'; }
  else if (confidence >= 58) { signal = 'BUY'; action = 'Favourable risk/reward'; }
  else if (confidence >= 45) { signal = 'HOLD'; action = 'Maintain current position'; }
  else if (confidence >= 32) { signal = 'SELL'; action = 'Consider reducing exposure'; }
  else { signal = 'STRONG SELL'; action = 'Exit position'; }

  // RISK ASSESSMENT
  const riskFactors = [];
  const atrPct = tech?.atr_pct ? parseFloat(tech.atr_pct) : null;
  if (atrPct && atrPct > 3) riskFactors.push(`High daily volatility: ${atrPct.toFixed(1)}% ATR`);
  if (catalysts.find(e => e.fact.includes('Earnings'))) riskFactors.push('Binary earnings event imminent');
  if (bearScore > 15) riskFactors.push('Multiple bearish signals — elevated downside risk');
  if (macro?.vix?.value > 25) riskFactors.push(`Elevated market fear: VIX ${macro?.vix?.value?.toFixed(0)}`);
  const riskLevel = riskFactors.length >= 2 ? 'HIGH' : riskFactors.length === 1 ? 'MEDIUM' : 'LOW';

  // PRICE TARGETS
  const targets = {};
  const price = stock?.price?.price;
  if (tech?.nearest_resistance) targets.resistance = parseFloat(tech.nearest_resistance);
  if (tech?.nearest_support) {
    targets.support = parseFloat(tech.nearest_support);
    targets.stopLoss = parseFloat(tech.nearest_support) * 0.99;
  }
  if (stock?.analyst?.targetPrice) targets.analystTarget = stock.analyst.targetPrice;
  if (targets.resistance && targets.stopLoss && price) {
    const reward = targets.resistance - price;
    const risk = price - targets.stopLoss;
    if (risk > 0) targets.riskReward = parseFloat((reward / risk).toFixed(1));
  }

  const result = {
    ticker,
    signal,
    confidence,
    action,
    bullScore,
    bearScore,
    riskLevel,
    riskFactors,
    targets,
    price: stock?.price || null,
    bullEvidence: evidence.filter(e => e.direction === 1).sort((a, b) => b.weight - a.weight),
    bearEvidence: evidence.filter(e => e.direction === -1).sort((a, b) => b.weight - a.weight),
    catalysts,
    evidenceCount: evidence.length,
    technicalGrade: tech?.technical_grade || null,
    technicalScore: tech?.technical_score || null,
    rsi: tech?.rsi_14 ? parseFloat(tech.rsi_14) : null,
    trend: tech?.trend || null,
    generatedAt: new Date().toISOString(),
  };

  await cache.setEx(ck, CACHE_TTL, JSON.stringify(result)).catch(() => {});
  return result;
}

async function generatePortfolioDecision() {
  const ck = 'decision:portfolio';
  const c = await cache.get(ck).catch(() => null);
  if (c) { try { return JSON.parse(c); } catch {} }

  const { getPortfolio } = require('./t212');
  let positions = [];
  try { positions = await getPortfolio() || []; } catch {}

  if (!positions.length) return { decisions: [], summary: { overallAction: 'NO_DATA', highRiskPositions: 0, strongBuys: 0, strongSells: 0, avgConfidence: 0 } };

  const signals = await Promise.all(
    positions.map(p => generateMasterSignal(p.ticker).catch(() => null))
  );

  const decisions = signals.filter(Boolean).map((sig, i) => {
    const pos = positions[i];
    let derivedAction = sig.action;
    if (sig.signal.includes('SELL') && (pos?.ppl || 0) > 0) derivedAction = 'Consider taking profit';
    if (sig.signal.includes('SELL') && (pos?.ppl || 0) < 0) derivedAction = 'Cut losses';
    if (sig.signal.includes('BUY') && (pos?.ppl || 0) < -10) derivedAction = 'Consider averaging down';
    return { ...sig, position: pos, derivedAction };
  });

  const sells = decisions.filter(d => d.signal.includes('SELL'));
  const result = {
    decisions,
    summary: {
      overallAction: sells.length > positions.length / 2 ? 'REDUCE RISK' : 'HOLD',
      highRiskPositions: decisions.filter(d => d.riskLevel === 'HIGH').length,
      strongBuys: decisions.filter(d => d.signal === 'STRONG BUY').length,
      strongSells: decisions.filter(d => d.signal === 'STRONG SELL').length,
      avgConfidence: decisions.length ? Math.round(decisions.reduce((s, d) => s + d.confidence, 0) / decisions.length) : 0,
      attentionNeeded: sells.map(d => ({ ticker: d.ticker, signal: d.signal, confidence: d.confidence })),
    },
    generatedAt: new Date().toISOString(),
  };

  await cache.setEx(ck, 600, JSON.stringify(result)).catch(() => {});
  return result;
}

module.exports = { generateMasterSignal, generatePortfolioDecision };
