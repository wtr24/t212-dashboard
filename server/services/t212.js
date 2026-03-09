const axios = require('axios');
const redis = require('./cache');
const { query } = require('../models/db');

const BASE = 'https://live.trading212.com/api/v0';

function headers() {
  return { Authorization: process.env.T212_API_KEY || '', 'Content-Type': 'application/json' };
}

function hasKey() {
  return !!process.env.T212_API_KEY;
}

async function fromRedis(key) {
  try { const v = await redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}

async function toRedis(key, ttl, data) {
  try { await redis.setEx(key, ttl, JSON.stringify(data)); } catch {}
}

async function fromDB(table, orderBy = 'updated_at DESC') {
  try {
    const r = await query(`SELECT raw_data, updated_at FROM ${table} ORDER BY ${orderBy} LIMIT 1`);
    if (r.rows.length) return { data: r.rows[0].raw_data, age: r.rows[0].updated_at };
  } catch {}
  return null;
}

async function savePortfolioDB(positions) {
  for (const p of positions) {
    const val = (p.currentPrice || 0) * (p.quantity || 0);
    const pnlPct = p.averagePrice > 0 ? ((p.currentPrice - p.averagePrice) / p.averagePrice) * 100 : 0;
    await query(
      `INSERT INTO positions (ticker, quantity, avg_price, current_price, pnl, pnl_pct, market_value, raw_data, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (ticker) DO UPDATE SET
         quantity=$2, avg_price=$3, current_price=$4, pnl=$5, pnl_pct=$6,
         market_value=$7, raw_data=$8, updated_at=NOW()`,
      [p.ticker, p.quantity, p.averagePrice, p.currentPrice, p.ppl, pnlPct, val, JSON.stringify(p)]
    ).catch(() => {});
  }
}

async function saveCashDB(cash) {
  await query(
    `INSERT INTO account_cache (key, raw_data, updated_at) VALUES ('cash', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET raw_data=$1, updated_at=NOW()`,
    [JSON.stringify(cash)]
  ).catch(() => {});
}

async function getPortfolioFromDB() {
  try {
    const r = await query('SELECT raw_data, updated_at FROM positions ORDER BY market_value DESC');
    if (r.rows.length) return { positions: r.rows.map(r => r.raw_data), age: r.rows[0].updated_at };
  } catch {}
  return null;
}

async function getCashFromDB() {
  try {
    const r = await query("SELECT raw_data, updated_at FROM account_cache WHERE key='cash'");
    if (r.rows.length) return { cash: r.rows[0].raw_data, age: r.rows[0].updated_at };
  } catch {}
  return null;
}

async function getPortfolio() {
  const redisData = await fromRedis('t212:portfolio');
  if (redisData) return { data: redisData, source: 'redis' };

  if (!hasKey()) {
    const db = await getPortfolioFromDB();
    if (db) return { data: db.positions, source: 'db', age: db.age };
    return { data: [], source: 'no_key' };
  }

  try {
    const { data } = await axios.get(`${BASE}/equity/portfolio`, { headers: headers(), timeout: 10000 });
    const positions = Array.isArray(data) ? data : (data.items || data.positions || []);
    await toRedis('t212:portfolio', 30, positions);
    await savePortfolioDB(positions);
    return { data: positions, source: 'live' };
  } catch (e) {
    const db = await getPortfolioFromDB();
    if (db) return { data: db.positions, source: 'db', age: db.age };
    return { data: [], source: 'error', error: e.message };
  }
}

async function getCash() {
  const redisData = await fromRedis('t212:cash');
  if (redisData) return { data: redisData, source: 'redis' };

  if (!hasKey()) {
    const db = await getCashFromDB();
    if (db) return { data: db.cash, source: 'db', age: db.age };
    return { data: {}, source: 'no_key' };
  }

  try {
    const { data } = await axios.get(`${BASE}/equity/account/cash`, { headers: headers(), timeout: 10000 });
    await toRedis('t212:cash', 60, data);
    await saveCashDB(data);
    return { data, source: 'live' };
  } catch (e) {
    const db = await getCashFromDB();
    if (db) return { data: db.cash, source: 'db', age: db.age };
    return { data: {}, source: 'error', error: e.message };
  }
}

async function getAccountInfo() {
  const cached = await fromRedis('t212:info');
  if (cached) return { data: cached, source: 'redis' };
  if (!hasKey()) return { data: { currencyCode: 'GBP', type: 'ISA' }, source: 'no_key' };
  try {
    const { data } = await axios.get(`${BASE}/equity/account/info`, { headers: headers(), timeout: 10000 });
    await toRedis('t212:info', 300, data);
    return { data, source: 'live' };
  } catch { return { data: { currencyCode: 'GBP', type: 'ISA' }, source: 'error' }; }
}

async function getOrders() {
  const cached = await fromRedis('t212:orders');
  if (cached) return cached;
  if (!hasKey()) return [];
  try {
    const { data } = await axios.get(`${BASE}/history/orders?limit=50`, { headers: headers(), timeout: 10000 });
    const orders = data.items || data || [];
    await toRedis('t212:orders', 300, orders);
    return orders;
  } catch { return []; }
}

async function getDividends() {
  const cached = await fromRedis('t212:dividends');
  if (cached) return cached;
  if (!hasKey()) return [];
  try {
    const { data } = await axios.get(`${BASE}/history/dividends?limit=50`, { headers: headers(), timeout: 10000 });
    const divs = data.items || data || [];
    await toRedis('t212:dividends', 300, divs);
    return divs;
  } catch { return []; }
}

async function getTransactions() {
  const cached = await fromRedis('t212:transactions');
  if (cached) return cached;
  if (!hasKey()) return [];
  try {
    const { data } = await axios.get(`${BASE}/history/transactions?limit=50`, { headers: headers(), timeout: 10000 });
    const txns = data.items || data || [];
    await toRedis('t212:transactions', 300, txns);
    return txns;
  } catch { return []; }
}

async function getPies() {
  const cached = await fromRedis('t212:pies');
  if (cached) return cached;
  if (!hasKey()) return [];
  try {
    const { data } = await axios.get(`${BASE}/equity/pies`, { headers: headers(), timeout: 10000 });
    const pies = Array.isArray(data) ? data : [];
    await toRedis('t212:pies', 300, pies);
    return pies;
  } catch { return []; }
}

function calcMetrics(portfolio, cash) {
  const cashData = cash?.data || cash || {};
  const positions = Array.isArray(portfolio) ? portfolio : (portfolio?.data || []);
  const totalEquity = positions.reduce((s, p) => s + ((p.currentPrice || 0) * (p.quantity || 0)), 0);
  const freeCash = cashData.free || cashData.cash || 0;
  const totalValue = totalEquity + freeCash;
  const totalPnl = positions.reduce((s, p) => s + (p.ppl || 0), 0);
  const totalCost = positions.reduce((s, p) => s + ((p.averagePrice || 0) * (p.quantity || 0)), 0);
  const returnPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const sorted = [...positions].sort((a, b) => (b.ppl || 0) - (a.ppl || 0));
  return { totalValue, totalEquity, freeCash, totalPnl, totalCost, returnPct, best: sorted.slice(0, 5), worst: sorted.slice(-5).reverse() };
}

module.exports = { getPortfolio, getCash, getAccountInfo, getOrders, getDividends, getTransactions, getPies, calcMetrics, hasKey };
