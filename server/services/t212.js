const axios = require('axios');
const redis = require('./cache');
const { query } = require('../models/db');

const BASE = 'https://live.trading212.com/api/v0';

const COMPANY_MAP = {
  PLTR:'Palantir Technologies',NVDA:'NVIDIA Corporation',AAPL:'Apple Inc.',
  MSFT:'Microsoft Corporation',TSLA:'Tesla Inc.',META:'Meta Platforms',
  GOOGL:'Alphabet Inc.',AMZN:'Amazon.com Inc.',JPM:'JPMorgan Chase',
  BRK:'Berkshire Hathaway',JNJ:'Johnson & Johnson',V:'Visa Inc.',
  WMT:'Walmart Inc.',XOM:'ExxonMobil',UNH:'UnitedHealth Group',
  PG:'Procter & Gamble',MA:'Mastercard Inc.',HD:'Home Depot',
  COST:'Costco Wholesale',AVGO:'Broadcom Inc.',LLY:'Eli Lilly',
  ABBV:'AbbVie Inc.',CRM:'Salesforce Inc.',NFLX:'Netflix Inc.',
  AMD:'Advanced Micro Devices',INTC:'Intel Corporation',QCOM:'Qualcomm',
  ORCL:'Oracle Corporation',IBM:'IBM Corporation',ADBE:'Adobe Inc.',
  NOW:'ServiceNow',MU:'Micron Technology',PANW:'Palo Alto Networks',
  CRWD:'CrowdStrike Holdings',SNOW:'Snowflake Inc.',NET:'Cloudflare',
  ASML:'ASML Holding',TSM:'Taiwan Semiconductor',SMCI:'Super Micro Computer',
  BP:'BP p.l.c.',SHEL:'Shell p.l.c.',HSBA:'HSBC Holdings',VOD:'Vodafone Group',
  GSK:'GSK p.l.c.',AZN:'AstraZeneca',RIO:'Rio Tinto',BHP:'BHP Group',
  ARM:'Arm Holdings',HOOD:'Robinhood Markets',COIN:'Coinbase Global',
  MSTR:'MicroStrategy',SOUN:'SoundHound AI',IONQ:'IonQ Inc.',
};

function cleanTicker(raw) {
  if (!raw) return raw;
  const clean = raw.replace(/[_](US|UK|EQ|NASDAQ|NYSE|LSE|ALL|EQ)[_A-Z0-9]*/g, '');
  return clean || raw.split('_')[0];
}

function getCompanyName(ticker) {
  return COMPANY_MAP[ticker] || null;
}

function buildAuth() {
  const key = process.env.T212_API_KEY;
  const secret = process.env.T212_API_SECRET;
  if (!key || !secret) return null;
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

function hasKey() {
  return !!(process.env.T212_API_KEY && process.env.T212_API_SECRET);
}

function client() {
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: buildAuth(), Accept: 'application/json' },
    timeout: 10000,
  });
}

async function fromRedis(key) {
  try { const v = await redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}

async function toRedis(key, ttl, data) {
  try { await redis.setEx(key, ttl, JSON.stringify(data)); } catch {}
}

async function savePositionsToDB(positions) {
  for (const p of positions) {
    const effectivePrice = (p.currentPrice || 0) > 0 ? p.currentPrice : (p.averagePrice || 0);
    const value = effectivePrice * (p.quantity || 0);
    const pnlPct = p.averagePrice > 0 ? ((p.currentPrice - p.averagePrice) / p.averagePrice) * 100 : 0;
    await query(
      `INSERT INTO positions (ticker, quantity, avg_price, current_price, pnl, pnl_pct, market_value, raw_data, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (ticker) DO UPDATE SET
         quantity=$2, avg_price=$3, current_price=$4, pnl=$5,
         pnl_pct=$6, market_value=$7, raw_data=$8, updated_at=NOW()`,
      [p.ticker, p.quantity, p.averagePrice, p.currentPrice, p.ppl, pnlPct, value, JSON.stringify(p)]
    ).catch(() => {});
  }
}

async function saveAccountToDB(summary) {
  await query(
    `INSERT INTO account_cache (key, raw_data, updated_at) VALUES ('summary', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET raw_data=$1, updated_at=NOW()`,
    [JSON.stringify(summary)]
  ).catch(() => {});
}

async function getPositionsFromDB() {
  try {
    const r = await query('SELECT raw_data, updated_at FROM positions ORDER BY market_value DESC');
    if (r.rows.length) return {
      positions: r.rows.map(row => {
        const p = row.raw_data;
        const ct = cleanTicker(p.ticker);
        return { ...p, ticker: ct, rawTicker: p.ticker, companyName: p.companyName || getCompanyName(ct) };
      }),
      age: r.rows[0].updated_at
    };
  } catch {}
  return null;
}

async function getAccountFromDB() {
  try {
    const r = await query("SELECT raw_data, updated_at FROM account_cache WHERE key='summary'");
    if (r.rows.length) return { summary: r.rows[0].raw_data, age: r.rows[0].updated_at };
  } catch {}
  return null;
}

async function getAccountSummary() {
  const cached = await fromRedis('t212:summary');
  if (cached) return { data: cached, source: 'redis' };

  if (!hasKey()) {
    const db = await getAccountFromDB();
    if (db) return { data: db.summary, source: 'db', age: db.age };
    return { data: null, source: 'no_key' };
  }

  try {
    const { data } = await client().get('/equity/account/summary');
    await toRedis('t212:summary', 30, data);
    await saveAccountToDB(data);
    return { data, source: 'live' };
  } catch (e) {
    const db = await getAccountFromDB();
    if (db) return { data: db.summary, source: 'db', age: db.age };
    return { data: null, source: 'error', error: e.message };
  }
}

async function getPortfolio() {
  const cached = await fromRedis('t212:portfolio');
  if (cached) return { data: cached, source: 'redis' };

  if (!hasKey()) {
    const db = await getPositionsFromDB();
    if (db) return { data: db.positions, source: 'db', age: db.age };
    return { data: [], source: 'no_key' };
  }

  try {
    const { data } = await client().get('/equity/portfolio');
    const raw = Array.isArray(data) ? data : [];
    const positions = raw.map(p => {
      const ct = cleanTicker(p.ticker);
      return { ...p, ticker: ct, rawTicker: p.ticker, companyName: getCompanyName(ct) };
    });
    await toRedis('t212:portfolio', 30, positions);
    await savePositionsToDB(positions);
    return { data: positions, source: 'live' };
  } catch (e) {
    const db = await getPositionsFromDB();
    if (db) return { data: db.positions, source: 'db', age: db.age };
    return { data: [], source: 'error', error: e.message };
  }
}

async function getOrders() {
  const cached = await fromRedis('t212:orders');
  if (cached) return cached;
  if (!hasKey()) return [];
  try {
    const { data } = await client().get('/equity/history/orders', { params: { limit: 50 } });
    const items = data.items || [];
    const normalized = items.map(item => ({
      ...item,
      ticker: (item.ticker || '').replace(/_[A-Z]{2}_EQ$/, '').replace(/_[A-Z]+$/, ''),
      type: item.type?.includes('BUY') ? 'BUY' : 'SELL',
      quantity: item.filledQuantity || item.orderedQuantity || 0,
      price: item.limitPrice || item.stopPrice || 0,
      total: (item.filledQuantity || item.orderedQuantity || 0) * (item.limitPrice || item.stopPrice || 0),
    }));
    await toRedis('t212:orders', 300, normalized);
    return normalized;
  } catch { return []; }
}

async function getDividends() {
  const cached = await fromRedis('t212:dividends');
  if (cached) return cached;
  if (!hasKey()) return [];
  try {
    const { data } = await client().get('/equity/history/dividends', { params: { limit: 50 } });
    const items = data.items || [];
    await toRedis('t212:dividends', 300, items);
    return items;
  } catch { return []; }
}

async function getTransactions() {
  const cached = await fromRedis('t212:transactions');
  if (cached) return cached;
  if (!hasKey()) return [];
  try {
    const { data } = await client().get('/equity/history/transactions', { params: { limit: 50 } });
    const items = data.items || [];
    await toRedis('t212:transactions', 300, items);
    return items;
  } catch { return []; }
}

async function getPies() {
  const cached = await fromRedis('t212:pies');
  if (cached) return cached;
  if (!hasKey()) return [];
  try {
    const { data } = await client().get('/equity/pies');
    const pies = Array.isArray(data) ? data : [];
    await toRedis('t212:pies', 300, pies);
    return pies;
  } catch { return []; }
}

function calcMetrics(portfolio, summary) {
  const positions = Array.isArray(portfolio) ? portfolio : [];
  const inv = summary?.investments || {};
  const cash = summary?.cash || {};
  return {
    totalValue: summary?.totalValue || 0,
    currentValue: inv.currentValue || 0,
    totalCost: inv.totalCost || 0,
    unrealizedPnl: inv.unrealizedProfitLoss || 0,
    realizedPnl: inv.realizedProfitLoss || 0,
    availableCash: cash.availableToTrade || 0,
    inPies: cash.inPies || 0,
    returnPct: inv.totalCost > 0 ? (inv.unrealizedProfitLoss / inv.totalCost) * 100 : 0,
    positionCount: positions.length,
    best: [...positions].sort((a, b) => (b.ppl || 0) - (a.ppl || 0)).slice(0, 5),
    worst: [...positions].sort((a, b) => (a.ppl || 0) - (b.ppl || 0)).slice(0, 5),
  };
}

module.exports = { getAccountSummary, getPortfolio, getOrders, getDividends, getTransactions, getPies, calcMetrics, hasKey };
