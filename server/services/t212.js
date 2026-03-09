const axios = require('axios');
const redis = require('./cache');

const BASE = 'https://live.trading212.com/api/v0';

const MOCK_PORTFOLIO = [
  { ticker: 'AAPL', fullName: 'Apple Inc', quantity: 10, averagePrice: 175.20, currentPrice: 182.50, ppl: 73.00, fxPpl: 0, initialFillDate: '2024-01-15T10:00:00Z' },
  { ticker: 'TSLA', fullName: 'Tesla Inc', quantity: 5, averagePrice: 220.00, currentPrice: 195.30, ppl: -123.50, fxPpl: 0, initialFillDate: '2024-02-01T10:00:00Z' },
  { ticker: 'NVDA', fullName: 'NVIDIA Corp', quantity: 8, averagePrice: 480.00, currentPrice: 875.50, ppl: 3164.00, fxPpl: 0, initialFillDate: '2023-11-10T10:00:00Z' },
  { ticker: 'MSFT', fullName: 'Microsoft Corp', quantity: 12, averagePrice: 360.00, currentPrice: 415.20, ppl: 662.40, fxPpl: 0, initialFillDate: '2024-01-20T10:00:00Z' },
  { ticker: 'AMZN', fullName: 'Amazon.com Inc', quantity: 7, averagePrice: 175.00, currentPrice: 188.30, ppl: 93.10, fxPpl: 0, initialFillDate: '2024-03-05T10:00:00Z' },
  { ticker: 'GOOGL', fullName: 'Alphabet Inc', quantity: 15, averagePrice: 140.00, currentPrice: 152.80, ppl: 192.00, fxPpl: 0, initialFillDate: '2024-02-14T10:00:00Z' },
  { ticker: 'META', fullName: 'Meta Platforms', quantity: 6, averagePrice: 380.00, currentPrice: 505.40, ppl: 752.40, fxPpl: 0, initialFillDate: '2024-01-08T10:00:00Z' },
  { ticker: 'PLTR', fullName: 'Palantir Technologies', quantity: 50, averagePrice: 18.00, currentPrice: 28.50, ppl: 525.00, fxPpl: 0, initialFillDate: '2024-04-01T10:00:00Z' },
];

const MOCK_CASH = { free: 1250.42, invested: 42380.00, result: 5338.40, total: 43630.42, blocked: 0, pieCash: 0 };
const MOCK_INFO = { id: 'demo-account', currencyCode: 'GBP', type: 'ISA', tradingType: 'EQUITY' };

function headers() {
  return { Authorization: process.env.T212_API_KEY || '' };
}

async function cached(key, ttl, fn) {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch {}
  const data = await fn();
  try { await redis.setEx(key, ttl, JSON.stringify(data)); } catch {}
  return data;
}

async function getPortfolio() {
  return cached('t212:portfolio', 30, async () => {
    if (!process.env.T212_API_KEY) return MOCK_PORTFOLIO;
    try {
      const { data } = await axios.get(`${BASE}/equity/portfolio`, { headers: headers() });
      return data;
    } catch { return MOCK_PORTFOLIO; }
  });
}

async function getCash() {
  return cached('t212:cash', 60, async () => {
    if (!process.env.T212_API_KEY) return MOCK_CASH;
    try {
      const { data } = await axios.get(`${BASE}/equity/account/cash`, { headers: headers() });
      return data;
    } catch { return MOCK_CASH; }
  });
}

async function getAccountInfo() {
  return cached('t212:info', 300, async () => {
    if (!process.env.T212_API_KEY) return MOCK_INFO;
    try {
      const { data } = await axios.get(`${BASE}/equity/account/info`, { headers: headers() });
      return data;
    } catch { return MOCK_INFO; }
  });
}

async function getOrders() {
  return cached('t212:orders', 300, async () => {
    if (!process.env.T212_API_KEY) return [];
    try {
      const { data } = await axios.get(`${BASE}/history/orders?limit=50`, { headers: headers() });
      return data.items || data || [];
    } catch { return []; }
  });
}

async function getDividends() {
  return cached('t212:dividends', 300, async () => {
    if (!process.env.T212_API_KEY) return [];
    try {
      const { data } = await axios.get(`${BASE}/history/dividends?limit=50`, { headers: headers() });
      return data.items || data || [];
    } catch { return []; }
  });
}

async function getTransactions() {
  return cached('t212:transactions', 300, async () => {
    if (!process.env.T212_API_KEY) return [];
    try {
      const { data } = await axios.get(`${BASE}/history/transactions?limit=50`, { headers: headers() });
      return data.items || data || [];
    } catch { return []; }
  });
}

async function getPies() {
  return cached('t212:pies', 300, async () => {
    if (!process.env.T212_API_KEY) return [];
    try {
      const { data } = await axios.get(`${BASE}/equity/pies`, { headers: headers() });
      return data || [];
    } catch { return []; }
  });
}

async function getInstrument(ticker) {
  return cached(`t212:instrument:${ticker}`, 3600, async () => {
    if (!process.env.T212_API_KEY) return null;
    try {
      const { data } = await axios.get(`${BASE}/instruments/metadata/ticker/${ticker}`, { headers: headers() });
      return data;
    } catch { return null; }
  });
}

function calcMetrics(portfolio, cash) {
  const totalValue = portfolio.reduce((s, p) => s + (p.currentPrice * p.quantity), 0) + (cash.free || 0);
  const totalPnl = portfolio.reduce((s, p) => s + (p.ppl || 0), 0);
  const totalCost = portfolio.reduce((s, p) => s + (p.averagePrice * p.quantity), 0);
  const returnPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const sorted = [...portfolio].sort((a, b) => (b.ppl || 0) - (a.ppl || 0));
  return { totalValue, totalPnl, totalCost, returnPct, best: sorted.slice(0, 5), worst: sorted.slice(-5).reverse() };
}

module.exports = { getPortfolio, getCash, getAccountInfo, getOrders, getDividends, getTransactions, getPies, getInstrument, calcMetrics };
