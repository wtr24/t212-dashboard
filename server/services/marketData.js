const axios = require('axios');
const cache = require('./cache');

async function getYahooData(ticker) {
  return cache.get(`yahoo:${ticker}`).then(async cached => {
    if (cached) return JSON.parse(cached);
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
      const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
      const q = data?.chart?.result?.[0];
      if (!q) return null;
      const meta = q.meta;
      const result = {
        currentPrice: meta.regularMarketPrice,
        previousClose: meta.chartPreviousClose,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        marketCap: meta.marketCap,
        currency: meta.currency,
        dailyChangeAmt: meta.regularMarketPrice - meta.chartPreviousClose,
        dailyChangePct: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      };
      await cache.setEx(`yahoo:${ticker}`, 300, JSON.stringify(result));
      return result;
    } catch { return null; }
  });
}

async function getFearGreed() {
  const key = 'market:feargreed';
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached);
  try {
    const { data } = await axios.get('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000
    });
    const score = data?.fear_and_greed?.score || 50;
    const rating = data?.fear_and_greed?.rating || 'Neutral';
    const result = { score: Math.round(score), rating };
    await cache.setEx(key, 1800, JSON.stringify(result));
    return result;
  } catch { return { score: 50, rating: 'Neutral' }; }
}

async function enrichPositions(positions) {
  const enriched = await Promise.all(positions.map(async pos => {
    const market = await getYahooData(pos.ticker).catch(() => null);
    return { ...pos, market };
  }));
  return enriched;
}

module.exports = { getYahooData, getFearGreed, enrichPositions };
