const axios = require('axios');
const cache = require('./cache');
const { query } = require('../models/db');

function ruleBasedAnalysis(pos, market) {
  const pnlPct = pos.averagePrice > 0 ? ((pos.currentPrice - pos.averagePrice) / pos.averagePrice) * 100 : 0;
  const rsi = market?.rsi || 50;
  const high52 = market?.fiftyTwoWeekHigh || pos.currentPrice;
  const low52 = market?.fiftyTwoWeekLow || pos.currentPrice;
  const priceRange = high52 - low52;
  const pricePos = priceRange > 0 ? ((pos.currentPrice - low52) / priceRange) * 100 : 50;

  let bullScore = 0;
  if (rsi < 30) bullScore += 30;
  else if (rsi < 45) bullScore += 15;
  else if (rsi > 70) bullScore -= 30;
  else if (rsi > 60) bullScore -= 10;

  if (pricePos < 20) bullScore += 25;
  else if (pricePos < 40) bullScore += 10;
  else if (pricePos > 80) bullScore -= 25;
  else if (pricePos > 65) bullScore -= 10;

  if (pnlPct > 10) bullScore += 15;
  else if (pnlPct > 0) bullScore += 5;
  else if (pnlPct < -10) bullScore -= 15;
  else if (pnlPct < 0) bullScore -= 5;

  const outlook = bullScore > 15 ? 'BULLISH' : bullScore < -15 ? 'BEARISH' : 'NEUTRAL';
  let signal = 'HOLD';
  if (bullScore > 40) signal = 'STRONG BUY';
  else if (bullScore > 15) signal = 'BUY';
  else if (bullScore < -40) signal = 'STRONG SELL';
  else if (bullScore < -15) signal = 'SELL';

  const absScore = Math.abs(bullScore);
  const confidence = Math.min(85, 40 + absScore);
  const riskLevel = Math.abs(pnlPct) > 20 || rsi > 75 || rsi < 25 ? 'HIGH' : Math.abs(pnlPct) > 10 ? 'MEDIUM' : 'LOW';

  const reasons = [];
  if (rsi < 30) reasons.push('RSI oversold');
  else if (rsi > 70) reasons.push('RSI overbought');
  if (pricePos < 20) reasons.push('near 52w low');
  else if (pricePos > 80) reasons.push('near 52w high');
  if (pnlPct > 5) reasons.push(`up ${pnlPct.toFixed(1)}% from cost`);
  else if (pnlPct < -5) reasons.push(`down ${Math.abs(pnlPct).toFixed(1)}% from cost`);

  return {
    outlook,
    signal,
    confidence: Math.round(confidence),
    targetPrice: null,
    riskLevel,
    keyReason: reasons.length ? reasons.join(', ') : 'No strong signals detected',
    catalysts: outlook === 'BULLISH' ? ['Technical oversold bounce', 'Mean reversion potential'] : ['Market stability', 'Sector rotation'],
    risks: riskLevel === 'HIGH' ? ['High volatility', 'Momentum continuation'] : ['Market downturn', 'Sector weakness'],
    source: 'rule-based',
  };
}

async function analysePosition(pos, market) {
  const key = `ai:v2:${pos.ticker}`;
  const cached = await cache.get(key).catch(() => null);
  if (cached) return JSON.parse(cached);

  let result = ruleBasedAnalysis(pos, market);

  if (process.env.GROQ_API_KEY) {
    try {
      const pnlPct = pos.averagePrice > 0 ? ((pos.currentPrice - pos.averagePrice) / pos.averagePrice) * 100 : 0;
      const prompt = `You are a financial analyst. Analyze this stock and respond ONLY with valid JSON, no other text:

Stock: ${pos.ticker} (${pos.fullName || pos.ticker})
Current Price: £${pos.currentPrice}
Avg Cost: £${pos.averagePrice}
P&L: ${pnlPct.toFixed(1)}%
52w High: £${market?.fiftyTwoWeekHigh || 'N/A'}
52w Low: £${market?.fiftyTwoWeekLow || 'N/A'}
Daily Change: ${market?.dailyChangePct?.toFixed(2) || 0}%

Respond with exactly this JSON:
{"outlook":"BULLISH","signal":"BUY","confidence":75,"targetPrice":150.00,"riskLevel":"MEDIUM","keyReason":"Brief reason under 15 words","catalysts":["reason1","reason2"],"risks":["risk1","risk2"]}

outlook: BULLISH or BEARISH or NEUTRAL
signal: STRONG BUY or BUY or HOLD or SELL or STRONG SELL
confidence: 0-100
targetPrice: absolute stock price in same currency as current price (e.g. if current is 45.00 target might be 52.00). NOT a percentage. NOT a % change. A real price number close to current price. If unsure respond null.
riskLevel: LOW or MEDIUM or HIGH`;

      const { data } = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }, {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 20000,
      });

      const text = data.choices?.[0]?.message?.content;
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.targetPrice != null) {
            const cp = pos.currentPrice || 1;
            if (parsed.targetPrice > cp * 4 || parsed.targetPrice < cp * 0.1 || !isFinite(parsed.targetPrice)) {
              parsed.targetPrice = null;
            }
          }
          result = { ...parsed, source: 'groq' };
        } catch {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) result = { ...JSON.parse(match[0]), source: 'groq' };
        }
      }
      console.log(`[ai] ${pos.ticker}: ${result.signal} (${result.confidence}%) via Groq`);
    } catch (e) {
      console.error(`[ai] Groq failed for ${pos.ticker}:`, e.response?.data?.error?.message || e.message);
    }
  } else {
    console.log(`[ai] ${pos.ticker}: ${result.signal} (${result.confidence}%) via rules`);
  }

  await cache.setEx(key, 3600, JSON.stringify(result)).catch(() => {});
  await query(
    `INSERT INTO ai_analysis (ticker, outlook, confidence, reason, risk_level, raw_data, analysed_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (ticker) DO UPDATE SET outlook=$2, confidence=$3, reason=$4, risk_level=$5, raw_data=$6, analysed_at=NOW()`,
    [pos.ticker, result.outlook, result.confidence, result.keyReason || result.reason, result.riskLevel || result.risk_level, JSON.stringify(result)]
  ).catch(() => {});

  return result;
}

async function analyseTop10(positions, marketData) {
  const top10 = [...positions].sort((a, b) => (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity)).slice(0, 10);
  return Promise.all(top10.map(pos => {
    const market = marketData.find(m => m.ticker === pos.ticker)?.market;
    return analysePosition(pos, market).then(analysis => ({ ticker: pos.ticker, ...analysis }));
  }));
}

module.exports = { analysePosition, analyseTop10, ruleBasedAnalysis };
