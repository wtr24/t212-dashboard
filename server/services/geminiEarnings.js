const https = require('https');
const { query } = require('../models/db');
const { getFromDB } = require('./technicalAnalysis');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FREE_RPD = parseInt(process.env.GEMINI_RPD || '20');
const RPM_DELAY_MS = parseInt(process.env.GEMINI_DELAY_MS || '15000'); // 15s = safe for 5 RPM

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Quota tracking (DB-persisted, survives restarts) ──────────────────────────

async function getRemainingQuota() {
  const r = await query(
    `SELECT requests_today FROM gemini_usage WHERE model=$1 AND date=CURRENT_DATE`,
    [GEMINI_MODEL]
  ).catch(() => ({ rows: [] }));
  const used = r.rows[0]?.requests_today || 0;
  return Math.max(0, FREE_RPD - used);
}

async function getUsedToday() {
  const r = await query(
    `SELECT requests_today FROM gemini_usage WHERE model=$1 AND date=CURRENT_DATE`,
    [GEMINI_MODEL]
  ).catch(() => ({ rows: [] }));
  return r.rows[0]?.requests_today || 0;
}

async function recordUsage() {
  await query(
    `INSERT INTO gemini_usage (model, date, requests_today, last_request_at)
     VALUES ($1, CURRENT_DATE, 1, NOW())
     ON CONFLICT (model, date) DO UPDATE
     SET requests_today = gemini_usage.requests_today + 1, last_request_at = NOW()`,
    [GEMINI_MODEL]
  ).catch(() => {});
}

async function markExhausted() {
  await query(
    `INSERT INTO gemini_usage (model, date, requests_today, last_request_at)
     VALUES ($1, CURRENT_DATE, $2, NOW())
     ON CONFLICT (model, date) DO UPDATE
     SET requests_today = $2, last_request_at = NOW()`,
    [GEMINI_MODEL, FREE_RPD]
  ).catch(() => {});
}

// ── HTTP call ─────────────────────────────────────────────────────────────────

function callGeminiOnce(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject(Object.assign(new Error('Gemini 429: quota/rate limit'), { code: 429 }));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Gemini ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          // 2.5-flash is a thinking model — parts[0] may be thought, find actual text
          const parts = parsed.candidates?.[0]?.content?.parts || [];
          const text = parts.find(p => p.text && !p.thought)?.text
            || parts.filter(p => p.text).map(p => p.text).join('').trim();
          if (!text) reject(new Error('Empty response from Gemini'));
          else resolve(text);
        } catch (e) {
          reject(new Error(`Parse failed: ${data.slice(0, 80)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Gemini timeout')); });
    req.write(body);
    req.end();
  });
}

async function callGemini(prompt, apiKey) {
  try {
    const text = await callGeminiOnce(prompt, apiKey);
    await recordUsage();
    return text;
  } catch (e) {
    if (e.code === 429) {
      console.log('[gemini] 429 hit, marking quota exhausted for today');
      await markExhausted();
      throw e;
    }
    throw e;
  }
}

// ── Yahoo Finance news context (pre-fetched, not Gemini browsing) ─────────────

function fetchYahooContext(ticker) {
  return new Promise(resolve => {
    const req = https.get(
      `https://query1.finance.yahoo.com/v8/finance/search?q=${encodeURIComponent(ticker)}&newsCount=8&quotesCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, timeout: 8000 },
      res => {
        let d = '';
        res.on('data', c => { d += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(d);
            const headlines = (json?.news || []).slice(0, 5).map(n => n.title).filter(Boolean);
            resolve(headlines);
          } catch { resolve([]); }
        });
      }
    );
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

// ── Compact prompt (~250-300 tokens) ─────────────────────────────────────────

function buildPrompt(earning, headlines, tech) {
  const {
    ticker, company, reportDate, reportTime, epsEstimate, revenueEstimate, fiscalQuarter,
    beatRateLast4 = 0, marketCap, analystRecommendation, analystTargetPrice,
    analystBuy, analystHold, analystSell,
  } = earning;
  const newsSection = headlines.length
    ? headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
    : 'No recent headlines';
  const lines = [];
  if (epsEstimate != null) lines.push(`EPS est: $${epsEstimate}`);
  if (revenueEstimate) lines.push(`Rev est: $${(revenueEstimate / 1e9).toFixed(1)}B`);
  if (marketCap) lines.push(`Mkt cap: $${(marketCap / 1e9).toFixed(0)}B`);
  if (analystRecommendation) lines.push(`Rec: ${analystRecommendation.toUpperCase()}`);
  if (analystTargetPrice) lines.push(`Target: $${analystTargetPrice}`);
  if (analystBuy != null || analystHold != null || analystSell != null) {
    lines.push(`Analysts: Buy=${analystBuy ?? 0} Hold=${analystHold ?? 0} Sell=${analystSell ?? 0}`);
  }
  lines.push(`Beat rate: ${beatRateLast4}/4`);
  const techSection = tech ? `
TECHNICAL ANALYSIS:
Trend: ${tech.trend || 'unknown'} | Score: ${tech.technical_score || '—'}/100 (${tech.technical_grade || '—'}) ${tech.technical_signal || ''}
MA: ${tech.price_vs_ma50_pct != null ? tech.price_vs_ma50_pct.toFixed(1) + '% vs 50MA' : '?'} · ${tech.price_vs_ma200_pct != null ? tech.price_vs_ma200_pct.toFixed(1) + '% vs 200MA' : '?'}${tech.golden_cross ? ' ⭐ GOLDEN CROSS' : tech.death_cross ? ' 💀 DEATH CROSS' : ''}
RSI(14): ${tech.rsi_14 != null ? tech.rsi_14.toFixed(1) : '?'} (${tech.rsi_signal || '?'}) | MACD: ${tech.macd_trend || '?'} | Stoch: ${tech.stoch_signal || '?'}
Bollinger: ${tech.bollinger_position || '?'} | Volume: ${tech.volume_ratio != null ? tech.volume_ratio.toFixed(1) + 'x avg' : '?'} | OBV: ${tech.obv_trend || '?'}
Support: ${tech.nearest_support != null ? '$' + tech.nearest_support.toFixed(2) : '?'} | Resistance: ${tech.nearest_resistance != null ? '$' + tech.nearest_resistance.toFixed(2) : '?'}
Bull signals: ${tech.bull_signals || 0} | Bear signals: ${tech.bear_signals || 0}` : '';
  return `Equity analyst. Predict earnings beat/miss for:
${ticker} (${company}) | ${fiscalQuarter || 'Q?'} | ${reportDate} ${reportTime || ''}
${lines.join(' | ')}

Recent headlines (Yahoo Finance):
${newsSection}
${techSection}

JSON only, no markdown, no explanation:
{"signal":"BUY","confidence":72,"beatProbability":68,"sentiment":"POSITIVE","newsSentiment":"POSITIVE","analystTrend":"STABLE","technicalView":"CONFIRMS_BULLISH","technicalNote":"one sentence on technical setup for earnings reaction","summary":"2 sentences specific to this company based on the data above.","keyFactors":["factor 1","factor 2","factor 3"],"risks":["risk 1","risk 2"]}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

async function analyzeEarning(earning) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: 'GEMINI_API_KEY not configured', ticker: earning.ticker };

  const remaining = await getRemainingQuota();
  if (remaining <= 0) {
    console.log(`[gemini] ${earning.ticker}: daily quota exhausted (${FREE_RPD} RPD)`);
    return { error: 'daily_quota_exhausted', ticker: earning.ticker };
  }

  const [headlines, tech] = await Promise.all([
    fetchYahooContext(earning.ticker),
    getFromDB(earning.ticker).catch(() => null),
  ]);
  const prompt = buildPrompt(earning, headlines, tech);

  try {
    const rawText = await callGemini(prompt, apiKey);
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: ${rawText.slice(0, 80)}`);

    const parsed = JSON.parse(jsonMatch[0]);
    const result = {
      ticker: earning.ticker,
      signal: ['BUY', 'SELL', 'HOLD'].includes(parsed.signal) ? parsed.signal : 'HOLD',
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
      beatProbability: Math.min(100, Math.max(0, parseInt(parsed.beatProbability) || 50)),
      sentiment: ['POSITIVE', 'NEGATIVE', 'MIXED', 'NEUTRAL'].includes(parsed.sentiment) ? parsed.sentiment : 'NEUTRAL',
      newsSentiment: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(parsed.newsSentiment) ? parsed.newsSentiment : 'NEUTRAL',
      analystTrend: ['UPGRADING', 'DOWNGRADING', 'STABLE'].includes(parsed.analystTrend) ? parsed.analystTrend : 'STABLE',
      summary: parsed.summary || '',
      keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors.slice(0, 5) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 4) : [],
      technicalView: ['CONFIRMS_BULLISH','CONFIRMS_BEARISH','DIVERGES','NEUTRAL'].includes(parsed.technicalView) ? parsed.technicalView : null,
      technicalNote: parsed.technicalNote || null,
      model: GEMINI_MODEL,
    };

    if (Array.isArray(parsed.newsHeadlines)) {
      for (const n of parsed.newsHeadlines.slice(0, 8)) {
        await query(
          `INSERT INTO earnings_ai_news (ticker, headline, source, sentiment, earnings_date)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [earning.ticker, n.headline, n.source, n.sentiment, earning.reportDate]
        ).catch(() => {});
      }
    }

    console.log(`[gemini] ${earning.ticker}: ${result.signal} conf=${result.confidence}% beat=${result.beatProbability}% (quota: ${remaining - 1} left)`);
    return result;
  } catch (e) {
    console.error(`[gemini] ${earning.ticker} failed:`, e.message);
    return { error: e.message, ticker: earning.ticker };
  }
}

module.exports = { analyzeEarning, GEMINI_MODEL, FREE_RPD, RPM_DELAY_MS, getRemainingQuota, getUsedToday };
