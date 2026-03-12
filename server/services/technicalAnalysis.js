const axios = require('axios');
const { query } = require('../models/db');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchOHLCV(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
    const { data } = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 12000 });
    const res = data?.chart?.result?.[0];
    if (!res) return null;

    const ts = res.timestamp || [];
    const q = res.indicators?.quote?.[0] || {};
    const adj = res.indicators?.adjclose?.[0]?.adjclose || [];
    const meta = res.meta || {};

    const candles = ts.map((t, i) => ({
      date: new Date(t * 1000),
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: q.close?.[i],
      volume: q.volume?.[i],
      adjClose: adj[i],
    })).filter(c => c.close != null && c.high != null && c.low != null && c.open != null && c.volume != null);

    return { candles, meta };
  } catch (e) {
    console.error(`[TA] fetchOHLCV ${ticker}: ${e.message}`);
    return null;
  }
}

// ── Indicator calculations ────────────────────────────────────────────────────

function calcSMA(closes, period) {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcEMAArray(closes, period) {
  if (closes.length < period) return new Array(closes.length).fill(null);
  const k = 2 / (period + 1);
  const result = new Array(closes.length).fill(null);
  result[period - 1] = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function calcEMA(closes, period) {
  const arr = calcEMAArray(closes, period);
  return arr[arr.length - 1];
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? -c : 0));
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcMACD(closes) {
  const ema12arr = calcEMAArray(closes, 12);
  const ema26arr = calcEMAArray(closes, 26);
  const macdArr = closes.map((_, i) => {
    if (ema12arr[i] == null || ema26arr[i] == null) return null;
    return ema12arr[i] - ema26arr[i];
  }).filter(v => v != null);
  if (macdArr.length < 9) return { macd: null, signal: null, histogram: null, prevHistogram: null };
  const sigArr = calcEMAArray(macdArr, 9);
  const macdLine = macdArr[macdArr.length - 1];
  const sigLine = sigArr[sigArr.length - 1];
  const histogram = macdLine - sigLine;
  const prevHistogram = macdArr.length > 1 && sigArr[sigArr.length - 2] != null
    ? macdArr[macdArr.length - 2] - sigArr[sigArr.length - 2]
    : null;
  return { macd: macdLine, signal: sigLine, histogram, prevHistogram };
}

function calcBollingerBands(closes, period = 20) {
  if (closes.length < period) return null;
  const sma = calcSMA(closes, period);
  const slice = closes.slice(-period);
  const variance = slice.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: sma + 2 * std,
    mid: sma,
    lower: sma - 2 * std,
    width: std > 0 ? ((4 * std) / sma) * 100 : 0,
  };
}

function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = candles.slice(1).map((c, i) => {
    const prev = candles[i];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcStochastic(candles, kPeriod = 14, dPeriod = 3) {
  if (candles.length < kPeriod + dPeriod) return { k: null, d: null };
  const kValues = [];
  for (let i = candles.length - dPeriod - kPeriod + 1; i <= candles.length - kPeriod; i++) {
    const slice = candles.slice(i, i + kPeriod);
    const highest = Math.max(...slice.map(c => c.high));
    const lowest = Math.min(...slice.map(c => c.low));
    const close = slice[slice.length - 1].close;
    kValues.push(highest === lowest ? 50 : ((close - lowest) / (highest - lowest)) * 100);
  }
  const stochK = kValues[kValues.length - 1];
  const stochD = kValues.reduce((a, b) => a + b, 0) / kValues.length;
  return { k: stochK, d: stochD };
}

function calcOBV(candles) {
  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
  }
  return obv;
}

function findSupportResistance(candles, lookback = 60) {
  const recent = candles.slice(-Math.min(lookback, candles.length));
  const currentPrice = candles[candles.length - 1].close;

  function cluster(levels) {
    const clusters = [];
    for (const level of levels) {
      const existing = clusters.find(c => Math.abs(c - level) / level < 0.015);
      if (!existing) clusters.push(level);
    }
    return clusters;
  }

  const highs = recent.map(c => c.high).sort((a, b) => b - a);
  const lows = recent.map(c => c.low).sort((a, b) => a - b);
  const resistanceLevels = cluster(highs).filter(h => h > currentPrice).slice(0, 2);
  const supportLevels = cluster(lows).filter(l => l < currentPrice).slice(0, 2);

  return {
    resistance1: resistanceLevels[0] || null,
    resistance2: resistanceLevels[1] || null,
    support1: supportLevels[0] || null,
    support2: supportLevels[1] || null,
  };
}

// ── Signal interpreter ────────────────────────────────────────────────────────

function interpretSignals(ind) {
  const signals = { bull: 0, bear: 0, neutral: 0, details: [] };

  if (ind.trend === 'STRONG_UPTREND') { signals.bull += 2; signals.details.push('Price above both MAs'); }
  else if (ind.trend === 'UPTREND') { signals.bull += 1; signals.details.push('Price above 50MA'); }
  else if (ind.trend === 'STRONG_DOWNTREND') { signals.bear += 2; signals.details.push('Price below both MAs'); }
  else if (ind.trend === 'DOWNTREND') { signals.bear += 1; signals.details.push('Price below 50MA'); }
  else { signals.neutral++; }

  if (ind.goldenCross) { signals.bull += 2; signals.details.push('Golden cross: 50MA above 200MA'); }
  if (ind.deathCross) { signals.bear += 2; signals.details.push('Death cross: 50MA below 200MA'); }

  if (ind.rsi != null) {
    if (ind.rsi < 30) { signals.bull += 2; signals.details.push(`RSI ${ind.rsi.toFixed(0)} oversold`); }
    else if (ind.rsi < 40) { signals.bull += 1; signals.details.push('RSI approaching oversold'); }
    else if (ind.rsi > 70) { signals.bear += 2; signals.details.push(`RSI ${ind.rsi.toFixed(0)} overbought`); }
    else if (ind.rsi > 60) { signals.bear += 1; signals.details.push('RSI elevated'); }
    else { signals.neutral++; signals.details.push(`RSI neutral (${ind.rsi.toFixed(0)})`); }
  }

  if (ind.macdHistogram != null) {
    if (ind.macdHistogram > 0 && ind.prevMacdHistogram != null && ind.macdHistogram > ind.prevMacdHistogram) {
      signals.bull += 1; signals.details.push('MACD momentum increasing');
    } else if (ind.macdHistogram < 0) {
      signals.bear += 1; signals.details.push('MACD bearish');
    } else { signals.neutral++; }
  }

  if (ind.bollingerPosition === 'BELOW_LOWER') { signals.bull += 1; signals.details.push('Price below Bollinger lower — oversold'); }
  else if (ind.bollingerPosition === 'ABOVE_UPPER') { signals.bear += 1; signals.details.push('Price above Bollinger upper — extended'); }

  if (ind.volumeRatio != null) {
    if (ind.volumeRatio > 1.5 && ind.trend && ind.trend.includes('UP')) { signals.bull += 1; signals.details.push('High volume confirming uptrend'); }
    if (ind.volumeRatio > 1.5 && ind.trend && ind.trend.includes('DOWN')) { signals.bear += 1; signals.details.push('High volume confirming downtrend'); }
  }
  if (ind.obvTrend === 'RISING' && ind.trend && ind.trend.includes('UP')) { signals.bull += 1; signals.details.push('OBV rising — accumulation'); }
  if (ind.obvTrend === 'FALLING' && ind.trend && ind.trend.includes('DOWN')) { signals.bear += 1; signals.details.push('OBV falling — distribution'); }

  if (ind.stochK != null) {
    if (ind.stochK < 20) { signals.bull += 1; signals.details.push('Stochastic oversold'); }
    else if (ind.stochK > 80) { signals.bear += 1; signals.details.push('Stochastic overbought'); }
  }

  const maxPossible = 12;
  const raw = signals.bull - signals.bear;
  const score = Math.round(((raw + maxPossible) / (2 * maxPossible)) * 100);
  const clamped = Math.max(0, Math.min(100, score));

  let grade, signal;
  if (clamped >= 75) { grade = 'A'; signal = 'STRONG BUY'; }
  else if (clamped >= 60) { grade = 'B'; signal = 'BUY'; }
  else if (clamped >= 45) { grade = 'C'; signal = 'HOLD'; }
  else if (clamped >= 30) { grade = 'D'; signal = 'SELL'; }
  else { grade = 'F'; signal = 'STRONG SELL'; }

  return { ...signals, score: clamped, grade, signal };
}

// ── DB upsert ─────────────────────────────────────────────────────────────────

async function upsertTechnicalAnalysis(r) {
  await query(
    `INSERT INTO technical_analysis (
       ticker, analysed_at,
       current_price, prev_close, open_price, day_high, day_low, week_52_high, week_52_low, price_vs_52w_pct,
       ma_20, ma_50, ma_200, ema_12, ema_26,
       price_vs_ma50_pct, price_vs_ma200_pct, ma50_vs_ma200_pct, golden_cross, death_cross, trend,
       rsi_14, rsi_signal,
       macd, macd_signal, macd_histogram, macd_trend,
       stoch_k, stoch_d, stoch_signal,
       atr_14, atr_pct,
       bollinger_upper, bollinger_mid, bollinger_lower, bollinger_width, bollinger_position,
       volume_today, volume_avg_20d, volume_ratio, volume_trend, obv, obv_trend,
       support_1, support_2, resistance_1, resistance_2,
       nearest_support, nearest_resistance, distance_to_support_pct, distance_to_resistance_pct,
       technical_score, technical_grade, technical_signal, bull_signals, bear_signals, neutral_signals,
       signal_details
     ) VALUES (
       $1, NOW(),
       $2,$3,$4,$5,$6,$7,$8,$9,
       $10,$11,$12,$13,$14,
       $15,$16,$17,$18,$19,$20,
       $21,$22,
       $23,$24,$25,$26,
       $27,$28,$29,
       $30,$31,
       $32,$33,$34,$35,$36,
       $37,$38,$39,$40,$41,$42,
       $43,$44,$45,$46,
       $47,$48,$49,$50,
       $51,$52,$53,$54,$55,$56,
       $57
     )
     ON CONFLICT (ticker) DO UPDATE SET
       analysed_at=NOW(),
       current_price=$2, prev_close=$3, open_price=$4, day_high=$5, day_low=$6,
       week_52_high=$7, week_52_low=$8, price_vs_52w_pct=$9,
       ma_20=$10, ma_50=$11, ma_200=$12, ema_12=$13, ema_26=$14,
       price_vs_ma50_pct=$15, price_vs_ma200_pct=$16, ma50_vs_ma200_pct=$17,
       golden_cross=$18, death_cross=$19, trend=$20,
       rsi_14=$21, rsi_signal=$22,
       macd=$23, macd_signal=$24, macd_histogram=$25, macd_trend=$26,
       stoch_k=$27, stoch_d=$28, stoch_signal=$29,
       atr_14=$30, atr_pct=$31,
       bollinger_upper=$32, bollinger_mid=$33, bollinger_lower=$34, bollinger_width=$35, bollinger_position=$36,
       volume_today=$37, volume_avg_20d=$38, volume_ratio=$39, volume_trend=$40, obv=$41, obv_trend=$42,
       support_1=$43, support_2=$44, resistance_1=$45, resistance_2=$46,
       nearest_support=$47, nearest_resistance=$48, distance_to_support_pct=$49, distance_to_resistance_pct=$50,
       technical_score=$51, technical_grade=$52, technical_signal=$53,
       bull_signals=$54, bear_signals=$55, neutral_signals=$56, signal_details=$57`,
    [
      r.ticker,
      r.currentPrice, r.prevClose, r.openPrice, r.dayHigh, r.dayLow, r.week52High, r.week52Low, r.priceVs52wPct,
      r.ma20, r.ma50, r.ma200, r.ema12, r.ema26,
      r.priceVsMa50Pct, r.priceVsMa200Pct, r.ma50VsMa200Pct, r.goldenCross, r.deathCross, r.trend,
      r.rsi14, r.rsiSignal,
      r.macd, r.macdSignal, r.macdHistogram, r.macdTrend,
      r.stochK, r.stochD, r.stochSignal,
      r.atr14, r.atrPct,
      r.bollingerUpper, r.bollingerMid, r.bollingerLower, r.bollingerWidth, r.bollingerPosition,
      r.volumeToday, r.volumeAvg20d, r.volumeRatio, r.volumeTrend, r.obv, r.obvTrend,
      r.support1, r.support2, r.resistance1, r.resistance2,
      r.nearestSupport, r.nearestResistance, r.distanceToSupportPct, r.distanceToResistancePct,
      r.technicalScore, r.technicalGrade, r.technicalSignal, r.bullSignals, r.bearSignals, r.neutralSignals,
      JSON.stringify(r.signalDetails || []),
    ]
  ).catch(e => console.error(`[TA] DB upsert ${r.ticker}:`, e.message));
}

// ── Main analysis ─────────────────────────────────────────────────────────────

async function analyseStock(ticker) {
  console.log(`[TA] analysing ${ticker}`);
  const fetched = await fetchOHLCV(ticker);
  if (!fetched) return { error: 'fetch_failed', ticker };

  const { candles, meta } = fetched;
  if (candles.length < 50) return { error: 'insufficient_data', ticker };

  const closes = candles.map(c => c.close);

  const ma20 = calcSMA(closes, 20);
  const ma50 = calcSMA(closes, 50);
  const ma200 = calcSMA(closes, 200);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const rsi = calcRSI(closes, 14);
  const macdResult = calcMACD(closes);
  const bb = calcBollingerBands(closes, 20);
  const atr = calcATR(candles, 14);
  const stoch = calcStochastic(candles);
  const obv = calcOBV(candles);
  const sr = findSupportResistance(candles, 60);

  const price = meta.regularMarketPrice || closes[closes.length - 1];
  const prevClose = meta.chartPreviousClose || closes[closes.length - 2];
  const week52High = meta.fiftyTwoWeekHigh || Math.max(...closes);
  const week52Low = meta.fiftyTwoWeekLow || Math.min(...closes);
  const volumeToday = meta.regularMarketVolume || candles[candles.length - 1].volume;
  const openPrice = meta.regularMarketOpen || candles[candles.length - 1].open;
  const dayHigh = meta.regularMarketDayHigh || candles[candles.length - 1].high;
  const dayLow = meta.regularMarketDayLow || candles[candles.length - 1].low;

  const recent20Vol = candles.slice(-20).map(c => c.volume);
  const avgVol20d = Math.round(recent20Vol.reduce((a, b) => a + b, 0) / recent20Vol.length);
  const volRatio = avgVol20d > 0 ? volumeToday / avgVol20d : 1;

  const obvPrev = calcOBV(candles.slice(0, -10));
  const obvTrend = obv > obvPrev ? 'RISING' : 'FALLING';

  // Trend
  let trend = 'NEUTRAL';
  if (ma50 && ma200) {
    if (price > ma50 && price > ma200) trend = 'STRONG_UPTREND';
    else if (price > ma50) trend = 'UPTREND';
    else if (price < ma50 && price < ma200) trend = 'STRONG_DOWNTREND';
    else if (price < ma50) trend = 'DOWNTREND';
  } else if (ma50) {
    trend = price > ma50 ? 'UPTREND' : 'DOWNTREND';
  }

  // Golden/death cross: 50MA crossed 200MA in last 5 days
  let goldenCross = false;
  let deathCross = false;
  if (candles.length >= 205 && ma50 && ma200) {
    const check = 5;
    const idxNow = closes.length - 1;
    const idxPrev = closes.length - 1 - check;
    const ma50Now = calcSMA(closes, 50);
    const ma200Now = calcSMA(closes, 200);
    const ma50Prev = calcSMA(closes.slice(0, idxPrev + 1), 50);
    const ma200Prev = calcSMA(closes.slice(0, idxPrev + 1), 200);
    if (ma50Now && ma200Now && ma50Prev && ma200Prev) {
      goldenCross = ma50Now > ma200Now && ma50Prev <= ma200Prev;
      deathCross = ma50Now < ma200Now && ma50Prev >= ma200Prev;
    }
  }

  // Bollinger position
  let bollingerPosition = 'INSIDE';
  if (bb) {
    if (price > bb.upper) bollingerPosition = 'ABOVE_UPPER';
    else if (price < bb.lower) bollingerPosition = 'BELOW_LOWER';
    else if (price > bb.mid) bollingerPosition = 'UPPER_HALF';
    else bollingerPosition = 'LOWER_HALF';
  }

  const indicators = {
    price, trend, goldenCross, deathCross, rsi,
    macdHistogram: macdResult.histogram, prevMacdHistogram: macdResult.prevHistogram,
    stochK: stoch.k, bollingerPosition,
    volumeRatio: volRatio, obvTrend,
  };
  const scored = interpretSignals(indicators);

  const priceVs52w = week52High !== week52Low
    ? ((price - week52Low) / (week52High - week52Low)) * 100
    : 50;

  const result = {
    ticker,
    currentPrice: price,
    prevClose,
    openPrice,
    dayHigh,
    dayLow,
    week52High,
    week52Low,
    priceVs52wPct: priceVs52w,
    ma20, ma50, ma200, ema12, ema26,
    priceVsMa50Pct: ma50 ? ((price - ma50) / ma50) * 100 : null,
    priceVsMa200Pct: ma200 ? ((price - ma200) / ma200) * 100 : null,
    ma50VsMa200Pct: ma50 && ma200 ? ((ma50 - ma200) / ma200) * 100 : null,
    goldenCross,
    deathCross,
    trend,
    rsi14: rsi,
    rsiSignal: rsi == null ? null : rsi < 30 ? 'OVERSOLD' : rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL',
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
    macdTrend: macdResult.histogram != null ? (macdResult.histogram > 0 ? 'BULLISH' : 'BEARISH') : null,
    stochK: stoch.k,
    stochD: stoch.d,
    stochSignal: stoch.k == null ? null : stoch.k < 20 ? 'OVERSOLD' : stoch.k > 80 ? 'OVERBOUGHT' : 'NEUTRAL',
    atr14: atr,
    atrPct: atr && price ? (atr / price) * 100 : null,
    bollingerUpper: bb?.upper,
    bollingerMid: bb?.mid,
    bollingerLower: bb?.lower,
    bollingerWidth: bb?.width,
    bollingerPosition,
    volumeToday,
    volumeAvg20d: avgVol20d,
    volumeRatio: volRatio,
    volumeTrend: volRatio > 1.2 ? 'HIGH' : 'NORMAL',
    obv,
    obvTrend,
    support1: sr.support1,
    support2: sr.support2,
    resistance1: sr.resistance1,
    resistance2: sr.resistance2,
    nearestSupport: sr.support1,
    nearestResistance: sr.resistance1,
    distanceToSupportPct: sr.support1 && price ? ((price - sr.support1) / price) * 100 : null,
    distanceToResistancePct: sr.resistance1 && price ? ((sr.resistance1 - price) / price) * 100 : null,
    technicalScore: scored.score,
    technicalGrade: scored.grade,
    technicalSignal: scored.signal,
    bullSignals: scored.bull,
    bearSignals: scored.bear,
    neutralSignals: scored.neutral,
    signalDetails: scored.details,
  };

  await upsertTechnicalAnalysis(result);
  return result;
}

async function analysePortfolio(tickers) {
  const results = [];
  for (const ticker of tickers) {
    try {
      const r = await analyseStock(ticker);
      results.push(r);
    } catch (e) {
      console.error(`[TA] ${ticker} failed:`, e.message);
      results.push({ error: e.message, ticker });
    }
    await sleep(350);
  }
  return results;
}

async function getFromDB(ticker) {
  const { rows } = await query(
    'SELECT * FROM technical_analysis WHERE ticker=$1', [ticker]
  ).catch(() => ({ rows: [] }));
  if (!rows.length) return null;
  const r = rows[0];
  // Parse signal_details back to array
  if (typeof r.signal_details === 'string') {
    try { r.signal_details = JSON.parse(r.signal_details); } catch { r.signal_details = []; }
  }
  return r;
}

async function isFresh(ticker, maxAgeMinutes = 60) {
  const r = await getFromDB(ticker);
  if (!r) return false;
  const age = (Date.now() - new Date(r.analysed_at).getTime()) / 60000;
  return age < maxAgeMinutes;
}

module.exports = { analyseStock, analysePortfolio, getFromDB, isFresh };
