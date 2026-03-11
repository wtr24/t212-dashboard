const axios = require('axios');
const { query } = require('../models/db');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

async function fetchYahooContext(ticker) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
  const headers = { 'User-Agent': UA, Accept: 'application/json' };

  const [newsRes, summaryRes] = await Promise.allSettled([
    axios.get(`https://query1.finance.yahoo.com/v8/finance/search?q=${ticker}&newsCount=10&quotesCount=0`, { headers, timeout: 8000 }),
    axios.get(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}`, {
      params: { modules: 'recommendationTrend,upgradeDowngradeHistory,defaultKeyStatistics,price' },
      headers, timeout: 10000,
    }),
  ]);

  const news = newsRes.status === 'fulfilled'
    ? (newsRes.value.data?.news || []).slice(0, 10).map(n => ({ headline: n.title, source: n.publisher, date: n.providerPublishTime }))
    : [];

  const summaryData = summaryRes.status === 'fulfilled' ? summaryRes.value.data?.quoteSummary?.result?.[0] : null;
  const upgrades = (summaryData?.upgradeDowngradeHistory?.history || [])
    .filter(u => { const d = new Date(u.epochGradeDate * 1000); return (Date.now() - d) < 30 * 86400000; })
    .slice(0, 5)
    .map(u => ({ firm: u.firm, fromGrade: u.fromGrade, toGrade: u.toGrade, action: u.action }));

  const price = summaryData?.price || {};
  const stats = summaryData?.defaultKeyStatistics || {};
  const recTrend = (summaryData?.recommendationTrend?.trend || [])[0] || {};

  return {
    recentHeadlines: news,
    analystUpgrades: upgrades,
    analystCount: (recTrend.strongBuy || 0) + (recTrend.buy || 0) + (recTrend.hold || 0) + (recTrend.sell || 0) + (recTrend.strongSell || 0),
    strongBuys: recTrend.strongBuy || 0,
    buys: recTrend.buy || 0,
    holds: recTrend.hold || 0,
    sells: (recTrend.sell || 0) + (recTrend.strongSell || 0),
    momentum30d: price.regularMarketChangePercent?.raw || 0,
    analystTrendText: upgrades.length > 0 ? (upgrades.filter(u => u.action === 'up').length > upgrades.filter(u => u.action === 'down').length ? 'UPGRADING' : 'DOWNGRADING') : 'STABLE',
  };
}

async function analyzeEarning(earning) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: 'GEMINI_API_KEY not configured', ticker: earning.ticker };

  const { ticker, company, reportDate, reportTime, epsEstimate, revenueEstimate, fiscalQuarter, beatRateLast4 = 0, avgSurprisePct = 0 } = earning;

  let ctx = { recentHeadlines: [], analystUpgrades: [], momentum30d: 0, analystTrendText: 'STABLE', strongBuys: 0, buys: 0, holds: 0, sells: 0 };
  try { ctx = await fetchYahooContext(ticker); } catch {}

  const headlineText = ctx.recentHeadlines.length
    ? ctx.recentHeadlines.map((n, i) => `${i + 1}. ${n.headline} (${n.source})`).join('\n')
    : 'No recent news available';

  const upgradeText = ctx.analystUpgrades.length
    ? ctx.analystUpgrades.map(u => `${u.firm}: ${u.fromGrade || 'N/A'} → ${u.toGrade} (${u.action})`).join('\n')
    : 'No recent analyst changes';

  const analystBreakdown = ctx.analystCount > 0
    ? `${ctx.strongBuys} Strong Buy, ${ctx.buys} Buy, ${ctx.holds} Hold, ${ctx.sells} Sell/Strong Sell`
    : 'No analyst data';

  const prompt = `You are a professional equity analyst specializing in earnings predictions.

Analyze this upcoming earnings report and predict if the company will beat or miss estimates.

COMPANY: ${company} (${ticker})
REPORT DATE: ${reportDate} ${reportTime || ''}
QUARTER: ${fiscalQuarter || 'Unknown'}

ESTIMATES:
- EPS Estimate: ${epsEstimate != null ? '$' + epsEstimate : 'N/A'}
- Revenue Estimate: ${revenueEstimate ? '$' + (revenueEstimate / 1e9).toFixed(1) + 'B' : 'N/A'}
- Historical beat rate: ${beatRateLast4}/4 last quarters
- Average historical surprise: ${avgSurprisePct.toFixed ? avgSurprisePct.toFixed(1) : avgSurprisePct}%

RECENT NEWS (last 14 days):
${headlineText}

ANALYST ACTIVITY (last 30 days):
${upgradeText}

ANALYST CONSENSUS: ${analystBreakdown}
30-DAY PRICE MOMENTUM: ${ctx.momentum30d >= 0 ? '+' : ''}${(ctx.momentum30d * 100).toFixed(1)}%

Based on ALL of this data provide your earnings prediction. Consider:
1. News sentiment - are headlines positive or negative about this company?
2. Analyst momentum - are analysts upgrading or downgrading?
3. Historical pattern - does this company consistently beat estimates?
4. Macro factors in recent news affecting this sector

Respond ONLY with this exact JSON object, no other text:
{
  "signal": "BUY",
  "confidence": 72,
  "beatProbability": 68,
  "sentiment": "POSITIVE",
  "newsSentiment": "POSITIVE",
  "analystTrend": "STABLE",
  "summary": "2-3 sentences specific to this company. What you expect and why based on the data above.",
  "keyFactors": ["factor max 10 words", "factor 2", "factor 3", "factor 4"],
  "risks": ["risk max 10 words", "risk 2", "risk 3"],
  "newsHeadlines": [{"headline": "headline text", "source": "source name", "sentiment": "POSITIVE"}]
}

signal must be BUY, SELL, or HOLD. sentiment must be POSITIVE, NEGATIVE, MIXED, or NEUTRAL. analystTrend must be UPGRADING, DOWNGRADING, or STABLE.`;

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1000 } },
      { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
    );

    const rawText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    const result = {
      ticker,
      signal: ['BUY','SELL','HOLD'].includes(parsed.signal) ? parsed.signal : 'HOLD',
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
      beatProbability: Math.min(100, Math.max(0, parseInt(parsed.beatProbability) || 50)),
      sentiment: ['POSITIVE','NEGATIVE','MIXED','NEUTRAL'].includes(parsed.sentiment) ? parsed.sentiment : 'NEUTRAL',
      newsSentiment: ['POSITIVE','NEGATIVE','NEUTRAL'].includes(parsed.newsSentiment) ? parsed.newsSentiment : 'NEUTRAL',
      analystTrend: ['UPGRADING','DOWNGRADING','STABLE'].includes(parsed.analystTrend) ? parsed.analystTrend : ctx.analystTrendText,
      summary: parsed.summary || '',
      keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors.slice(0, 5) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 4) : [],
      model: GEMINI_MODEL,
    };

    if (Array.isArray(parsed.newsHeadlines)) {
      for (const n of parsed.newsHeadlines.slice(0, 10)) {
        await query(
          `INSERT INTO earnings_ai_news (ticker, headline, source, sentiment, earnings_date)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [ticker, n.headline, n.source, n.sentiment, reportDate]
        ).catch(() => {});
      }
    }

    console.log(`[gemini] ${ticker}: ${result.signal} conf=${result.confidence}% beat=${result.beatProbability}%`);
    return result;
  } catch (e) {
    console.error(`[gemini] ${ticker} failed:`, e.response?.data?.error?.message || e.message);
    return {
      ticker, signal: 'HOLD', confidence: 30, beatProbability: 50,
      sentiment: 'NEUTRAL', newsSentiment: 'NEUTRAL', analystTrend: ctx.analystTrendText,
      summary: `Analysis unavailable: ${e.message}`, keyFactors: [], risks: [], model: 'error',
    };
  }
}

module.exports = { analyzeEarning, GEMINI_MODEL };
