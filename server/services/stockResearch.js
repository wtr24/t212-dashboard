const { getFullStockData, fetchYahooComplete } = require('./batchCallOptimizer');
const cache = require('./cache');
const { query } = require('../models/db');
const axios = require('axios');

async function getPolygonNews(ticker) {
  const key = process.env.POLYGON_KEY;
  if (!key) return [];
  const ck = 'poly_news_' + ticker;
  const cached = await cache.get(ck).catch(() => null);
  if (cached) { try { return JSON.parse(cached); } catch {} }
  try {
    const { data } = await axios.get(
      'https://api.polygon.io/v2/reference/news?ticker=' + ticker + '&limit=20&sort=published_utc&order=desc&apikey=' + key,
      { timeout: 10000 }
    );
    const items = data?.results || [];
    await cache.setEx(ck, 3600, JSON.stringify(items)).catch(() => {});
    return items;
  } catch { return []; }
}

async function getSecFilings(ticker) {
  const ck = 'sec_filings_' + ticker;
  const cached = await cache.get(ck).catch(() => null);
  if (cached) { try { return JSON.parse(cached); } catch {} }
  try {
    const today = new Date().toISOString().split('T')[0];
    const ago = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const q = encodeURIComponent('"' + ticker + '"');
    const url = 'https://efts.sec.gov/LATEST/search-index?q=' + q + '&forms=8-K,10-Q&dateRange=custom&startdt=' + ago + '&enddt=' + today;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'T212Dashboard research@t212dashboard.local' },
      timeout: 10000,
    });
    const filings = (data?.hits?.hits || []).slice(0, 6).map(h => ({
      formType: h._source?.form_type,
      filedDate: h._source?.file_date,
      period: h._source?.period_of_report,
      entityName: h._source?.entity_name,
      url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + ticker + '&type=' + (h._source?.form_type || '') + '&dateb=&owner=include&count=10',
    }));
    await cache.setEx(ck, 14400, JSON.stringify(filings)).catch(() => {});
    return filings;
  } catch { return []; }
}

function classifyNewsSentiment(title) {
  if (!title) return 'NEUTRAL';
  const h = title.toLowerCase();
  const bull = ['beat','beats','surge','jump','rise','gain','upgrade','record','strong','growth','exceed','raises','profit','bullish'];
  const bear = ['miss','misses','fall','drop','decline','cut','downgrade','loss','weak','concern','risk','warn','bearish','slump'];
  const b = bull.filter(w => h.includes(w)).length;
  const r = bear.filter(w => h.includes(w)).length;
  if (b > r) return 'POSITIVE';
  if (r > b) return 'NEGATIVE';
  return 'NEUTRAL';
}

async function generateAiVerdict(ticker, yahoo, earningsHistory) {
  if (!process.env.GEMINI_API_KEY) return null;
  const ck = 'research_ai_' + ticker;
  const c = await cache.get(ck).catch(() => null);
  if (c) { try { return JSON.parse(c); } catch {} }
  try {
    const { analyzeEarning } = require('./geminiEarnings');
    const beats = earningsHistory.filter(e => (e.epsSurprisePct || 0) > 0).length;
    const avg = earningsHistory.length
      ? earningsHistory.reduce((s, e) => s + (e.epsSurprisePct || 0), 0) / earningsHistory.length : 0;
    const result = await analyzeEarning({
      ticker, company: yahoo?.price?.shortName || ticker,
      reportDate: new Date().toISOString().split('T')[0],
      epsEstimate: yahoo?.estimates?.epsEstimate || 0,
      fiscalQuarter: 'current', beatRateLast4: beats,
      avgSurprisePct: Math.round(avg * 10) / 10,
    });
    if (result) await cache.setEx(ck, 21600, JSON.stringify(result)).catch(() => {});
    return result;
  } catch { return null; }
}

async function getFullResearch(ticker, forceRefresh = false) {
  const ck = 'research_full_' + ticker;
  if (!forceRefresh) {
    const c = await cache.get(ck).catch(() => null);
    if (c) { try { return JSON.parse(c); } catch {} }
  }
  console.log('[research] Building full report for ' + ticker);
  const [yR, ryR, nR, tR, cR, iR, sR, eR] = await Promise.allSettled([
    getFullStockData(ticker),
    fetchYahooComplete(ticker),
    getPolygonNews(ticker),
    query('SELECT * FROM technical_analysis WHERE ticker=$1', [ticker]),
    query('SELECT * FROM congress_trades WHERE UPPER(ticker)=UPPER($1) ORDER BY transaction_date DESC LIMIT 15', [ticker]),
    query('SELECT * FROM insider_trades WHERE UPPER(ticker)=UPPER($1) ORDER BY trade_date DESC LIMIT 15', [ticker]),
    getSecFilings(ticker),
    query('SELECT * FROM earnings_calendar WHERE UPPER(ticker)=UPPER($1) ORDER BY report_date DESC LIMIT 12', [ticker]),
  ]);
  const get = r => r.status === 'fulfilled' ? r.value : null;
  const yahoo = get(yR); const rawYahoo = get(ryR); const rawNews = get(nR) || [];
  const ta = get(tR)?.rows?.[0] || null;
  const congress = get(cR)?.rows || [];
  const insider = get(iR)?.rows || [];
  const filings = get(sR) || [];
  const earningsDb = get(eR)?.rows || [];
  const earningsHistory = yahoo?.earningsHistory || [];
  const beats = earningsHistory.filter(e => (e.epsSurprisePct || 0) > 0).length;
  const beatRate = earningsHistory.length ? Math.round(beats / earningsHistory.length * 100) : null;
  const avgSurprisePct = earningsHistory.length
    ? Math.round(earningsHistory.reduce((s, e) => s + (e.epsSurprisePct || 0), 0) / earningsHistory.length * 10) / 10 : null;
  const aiVerdict = await generateAiVerdict(ticker, yahoo, earningsHistory);
  const research = {
    ticker, generatedAt: new Date().toISOString(),
    company: {
      name: rawYahoo?.price?.longName || rawYahoo?.price?.shortName || ticker,
      sector: yahoo?.sector, industry: yahoo?.industry,
      description: rawYahoo?.assetProfile?.longBusinessSummary || null,
      employees: rawYahoo?.assetProfile?.fullTimeEmployees || null,
      website: rawYahoo?.assetProfile?.website || null,
    },
    price: yahoo?.price || null,
    metrics: {
      marketCap: yahoo?.price?.mktCap,
      pe: yahoo?.technical?.pe,
      forwardPE: rawYahoo?.defaultKeyStatistics?.forwardPE?.raw || null,
      peg: rawYahoo?.defaultKeyStatistics?.pegRatio?.raw || null,
      beta: yahoo?.technical?.beta,
      dividendYield: rawYahoo?.summaryDetail?.dividendYield?.raw || null,
      profitMargin: rawYahoo?.financialData?.profitMargins?.raw || null,
      revenueGrowth: rawYahoo?.financialData?.revenueGrowth?.raw || null,
      debtToEquity: rawYahoo?.financialData?.debtToEquity?.raw || null,
      roe: rawYahoo?.financialData?.returnOnEquity?.raw || null,
      week52High: yahoo?.technical?.week52High,
      week52Low: yahoo?.technical?.week52Low,
    },
    estimates: yahoo?.estimates || null,
    earningsHistory, revenueHistory: yahoo?.revenueHistory || [],
    earningsDb, beatRate, avgSurprisePct,
    nextEarningsDate: yahoo?.nextEarningsDate,
    analyst: yahoo?.analyst || null,
    technical: ta ? {
      score: ta.technical_score, grade: ta.technical_grade, signal: ta.technical_signal,
      trend: ta.trend, rsi: ta.rsi_14 ? parseFloat(ta.rsi_14) : null,
      macdTrend: ta.macd_trend, bollingerPosition: ta.bollinger_position,
      nearestSupport: ta.nearest_support ? parseFloat(ta.nearest_support) : null,
      nearestResistance: ta.nearest_resistance ? parseFloat(ta.nearest_resistance) : null,
      volumeRatio: ta.volume_ratio ? parseFloat(ta.volume_ratio) : null,
      goldenCross: ta.golden_cross, deathCross: ta.death_cross,
      ma50: ta.ma_50 ? parseFloat(ta.ma_50) : null,
      ma200: ta.ma_200 ? parseFloat(ta.ma_200) : null,
      atrPct: ta.atr_pct ? parseFloat(ta.atr_pct) : null,
      signalDetails: ta.signal_details, analysedAt: ta.analysed_at,
    } : null,
    news: rawNews.map(n => ({
      headline: n.title, source: n.publisher?.name,
      url: n.article_url, publishedAt: n.published_utc,
      sentiment: classifyNewsSentiment(n.title),
    })),
    congressTrades: congress, insiderTrades: insider, secFilings: filings, aiVerdict,
  };
  await cache.setEx(ck, 7200, JSON.stringify(research)).catch(() => {});
  return research;
}

async function getQuickResearch(ticker) {
  const ck = 'research_quick_' + ticker;
  const c = await cache.get(ck).catch(() => null);
  if (c) { try { return JSON.parse(c); } catch {} }
  try {
    const [yr, tr] = await Promise.allSettled([
      getFullStockData(ticker),
      query('SELECT technical_score,technical_grade,technical_signal,rsi_14 FROM technical_analysis WHERE ticker=$1', [ticker]),
    ]);
    const y = yr.status === 'fulfilled' ? yr.value : null;
    const t = tr.status === 'fulfilled' ? tr.value.rows[0] : null;
    const result = {
      ticker, price: y?.price,
      analyst: y?.analyst ? { recommendation: y.analyst.recommendation, targetPrice: y.analyst.targetPrice } : null,
      technical: t ? { score: t.technical_score, grade: t.technical_grade, signal: t.technical_signal, rsi: t.rsi_14 ? parseFloat(t.rsi_14) : null } : null,
    };
    await cache.setEx(ck, 300, JSON.stringify(result)).catch(() => {});
    return result;
  } catch { return { ticker }; }
}

module.exports = { getFullResearch, getQuickResearch };
