const https = require('https');
const { query } = require('../models/db');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function callGemini(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
    });
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Gemini ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text);
        } catch (e) {
          reject(new Error(`Parse failed: ${data.slice(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Gemini timeout')); });
    req.write(body);
    req.end();
  });
}

function fetchYahooContext(ticker) {
  return new Promise(resolve => {
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

    const newsReq = https.get(
      `https://query1.finance.yahoo.com/v8/finance/search?q=${ticker}&newsCount=10&quotesCount=0`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' }, timeout: 8000 },
      res => {
        let d = '';
        res.on('data', c => { d += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(d);
            const news = (json?.news || []).slice(0, 10).map(n => ({ headline: n.title, source: n.publisher }));
            resolve({ recentHeadlines: news, analystUpgrades: [], momentum30d: 0, analystTrendText: 'STABLE', strongBuys: 0, buys: 0, holds: 0, sells: 0, analystCount: 0 });
          } catch { resolve(defaultCtx()); }
        });
      }
    );
    newsReq.on('error', () => resolve(defaultCtx()));
    newsReq.on('timeout', () => { newsReq.destroy(); resolve(defaultCtx()); });
  });
}

function defaultCtx() {
  return { recentHeadlines: [], analystUpgrades: [], momentum30d: 0, analystTrendText: 'STABLE', strongBuys: 0, buys: 0, holds: 0, sells: 0, analystCount: 0 };
}

async function analyzeEarning(earning) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: 'GEMINI_API_KEY not configured', ticker: earning.ticker };

  const { ticker, company, reportDate, reportTime, epsEstimate, revenueEstimate, fiscalQuarter, beatRateLast4 = 0, avgSurprisePct = 0 } = earning;

  let ctx = defaultCtx();
  try { ctx = await fetchYahooContext(ticker); } catch {}

  const headlineText = ctx.recentHeadlines.length
    ? ctx.recentHeadlines.map((n, i) => `${i + 1}. ${n.headline} (${n.source})`).join('\n')
    : 'No recent news available';

  const prompt = `You are a professional equity analyst specializing in earnings predictions.

Analyze this upcoming earnings report and predict if the company will beat or miss estimates.

COMPANY: ${company} (${ticker})
REPORT DATE: ${reportDate} ${reportTime || ''}
QUARTER: ${fiscalQuarter || 'Unknown'}

ESTIMATES:
- EPS Estimate: ${epsEstimate != null ? '$' + epsEstimate : 'N/A'}
- Revenue Estimate: ${revenueEstimate ? '$' + (revenueEstimate / 1e9).toFixed(1) + 'B' : 'N/A'}
- Historical beat rate: ${beatRateLast4}/4 last quarters

RECENT NEWS (last 14 days):
${headlineText}

Respond ONLY with this exact JSON object, no markdown, no code blocks:
{
  "signal": "BUY",
  "confidence": 72,
  "beatProbability": 68,
  "sentiment": "POSITIVE",
  "newsSentiment": "POSITIVE",
  "analystTrend": "STABLE",
  "summary": "2-3 sentences specific to this company.",
  "keyFactors": ["factor max 10 words", "factor 2", "factor 3"],
  "risks": ["risk max 10 words", "risk 2"],
  "newsHeadlines": [{"headline": "headline text", "source": "source name", "sentiment": "POSITIVE"}]
}

signal must be BUY, SELL, or HOLD. sentiment must be POSITIVE, NEGATIVE, MIXED, or NEUTRAL. analystTrend must be UPGRADING, DOWNGRADING, or STABLE.`;

  try {
    const rawText = await callGemini(prompt, apiKey);

    // Strip markdown code blocks if present
    const cleaned = rawText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: ${rawText.slice(0, 100)}`);

    const parsed = JSON.parse(jsonMatch[0]);
    const result = {
      ticker,
      signal: ['BUY', 'SELL', 'HOLD'].includes(parsed.signal) ? parsed.signal : 'HOLD',
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
      beatProbability: Math.min(100, Math.max(0, parseInt(parsed.beatProbability) || 50)),
      sentiment: ['POSITIVE', 'NEGATIVE', 'MIXED', 'NEUTRAL'].includes(parsed.sentiment) ? parsed.sentiment : 'NEUTRAL',
      newsSentiment: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(parsed.newsSentiment) ? parsed.newsSentiment : 'NEUTRAL',
      analystTrend: ['UPGRADING', 'DOWNGRADING', 'STABLE'].includes(parsed.analystTrend) ? parsed.analystTrend : ctx.analystTrendText,
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

    console.log(`[gemini] ${ticker}: ${result.signal} conf=${result.confidence}% beat=${result.beatProbability}% model=${GEMINI_MODEL}`);
    return result;
  } catch (e) {
    console.error(`[gemini] ${ticker} failed:`, e.message);
    return { error: e.message, ticker };
  }
}

module.exports = { analyzeEarning, GEMINI_MODEL };
