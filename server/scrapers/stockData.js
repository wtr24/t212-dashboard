const axios = require('axios');
const cache = require('../services/cache');

const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
];
let uaIdx = 0;
const getUA = () => UA_LIST[uaIdx++ % UA_LIST.length];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchYahoo(ticker, type = 'quote') {
  const cacheKey = `stock:yahoo:${type}:${ticker}`;
  const ttl = type === 'quote' ? 60 : 3600;
  const cached = await cache.get(cacheKey).catch(() => null);
  if (cached) return JSON.parse(cached);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let url, result;
      if (type === 'quote') {
        url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
        const res = await axios.get(url, { headers: { 'User-Agent': getUA(), 'Accept': 'application/json' }, timeout: 12000 });
        const meta = res.data?.chart?.result?.[0]?.meta || {};
        result = {
          ticker,
          price: meta.regularMarketPrice || 0,
          open: meta.regularMarketOpen || 0,
          high: meta.regularMarketDayHigh || 0,
          low: meta.regularMarketDayLow || 0,
          close: meta.regularMarketPrice || 0,
          volume: meta.regularMarketVolume || 0,
          prevClose: meta.previousClose || meta.chartPreviousClose || 0,
          change: (meta.regularMarketPrice || 0) - (meta.previousClose || meta.chartPreviousClose || 0),
          changePct: meta.regularMarketChangePercent || 0,
          marketCap: meta.marketCap || 0,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
          currency: meta.currency || 'USD',
          name: meta.longName || meta.shortName || ticker,
          timestamp: Date.now(),
        };
      } else {
        const range = type === '1d' ? '1d' : type === '5d' ? '5d' : type === '1mo' ? '1mo' : type === '3mo' ? '3mo' : type === '1y' ? '1y' : '5y';
        const interval = ['1d','5d'].includes(range) ? '5m' : range === '1mo' ? '1h' : '1d';
        url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
        const res = await axios.get(url, { headers: { 'User-Agent': getUA(), 'Accept': 'application/json' }, timeout: 15000 });
        const chartData = res.data?.chart?.result?.[0];
        if (!chartData) throw new Error('No chart data');
        const timestamps = chartData.timestamp || [];
        const quotes = chartData.indicators?.quote?.[0] || {};
        result = timestamps.map((t, i) => ({
          time: Math.floor(t),
          open: parseFloat((quotes.open?.[i] || 0).toFixed(4)),
          high: parseFloat((quotes.high?.[i] || 0).toFixed(4)),
          low: parseFloat((quotes.low?.[i] || 0).toFixed(4)),
          close: parseFloat((quotes.close?.[i] || 0).toFixed(4)),
          volume: Math.round(quotes.volume?.[i] || 0),
        })).filter(c => c.open && c.high && c.low && c.close);
      }
      await cache.setEx(cacheKey, ttl, JSON.stringify(result)).catch(() => {});
      return result;
    } catch (e) {
      if (e.response?.status === 429) {
        await sleep(attempt * 3000);
      } else if (attempt === 3) {
        return type === 'quote' ? null : [];
      }
    }
    await sleep(200);
  }
  return type === 'quote' ? null : [];
}

async function getQuote(ticker) {
  return fetchYahoo(ticker.toUpperCase(), 'quote');
}

async function getHistory(ticker, range = '1mo') {
  return fetchYahoo(ticker.toUpperCase(), range);
}

module.exports = { getQuote, getHistory };
