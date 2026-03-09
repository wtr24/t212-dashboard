const axios = require('axios');
const cache = require('./cache');
const { query } = require('../models/db');

function ruleBasedAnalysis(pos, market) {
  const pnlPct = pos.averagePrice > 0 ? ((pos.currentPrice - pos.averagePrice) / pos.averagePrice) * 100 : 0;
  const outlook = pnlPct > 5 ? 'BULLISH' : pnlPct < -5 ? 'BEARISH' : 'NEUTRAL';
  const confidence = Math.min(90, Math.abs(pnlPct) * 3 + 40);
  const risk = Math.abs(pnlPct) > 20 ? 'HIGH' : Math.abs(pnlPct) > 10 ? 'MED' : 'LOW';
  return { outlook, confidence: Math.round(confidence), reason: `Position ${pnlPct > 0 ? 'up' : 'down'} ${Math.abs(pnlPct).toFixed(1)}% from avg cost`, risk_level: risk };
}

async function analysePosition(pos, market) {
  const key = `ai:${pos.ticker}`;
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached);

  let result = ruleBasedAnalysis(pos, market);

  if (process.env.GROQ_API_KEY) {
    try {
      const prompt = `Analyse ${pos.ticker} (${pos.fullName || pos.ticker}). Current price ${pos.currentPrice}. 52w range ${market?.fiftyTwoWeekLow || 'N/A'}-${market?.fiftyTwoWeekHigh || 'N/A'}. Daily change ${market?.dailyChangePct?.toFixed(2) || 0}%. Give: 1) outlook: BULLISH/BEARISH/NEUTRAL 2) confidence 0-100 3) key reason 15 words max 4) risk level: LOW/MED/HIGH. JSON only, keys: outlook, confidence, reason, risk_level`;
      const { data } = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama3-70b-8192',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      }, { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 });
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) result = { ...result, ...JSON.parse(match[0]) };
      }
    } catch {}
  }

  await cache.setEx(key, 3600, JSON.stringify(result));
  await query(
    `INSERT INTO ai_analysis (ticker, outlook, confidence, reason, risk_level, raw_data, analysed_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (ticker) DO UPDATE SET outlook=$2, confidence=$3, reason=$4, risk_level=$5, raw_data=$6, analysed_at=NOW()`,
    [pos.ticker, result.outlook, result.confidence, result.reason, result.risk_level, JSON.stringify(result)]
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
