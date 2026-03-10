const cache = require('./cache');
const { query } = require('../models/db');
const { getQuote, getHistory } = require('../scrapers/stockData');

async function searchStocks(q) {
  if (!q || q.length < 1) return [];
  const res = await query(
    `SELECT ticker, company, sector FROM sp500_stocks WHERE ticker ILIKE $1 OR company ILIKE $2 ORDER BY ticker LIMIT 15`,
    [`${q.toUpperCase()}%`, `%${q}%`]
  ).catch(() => ({ rows: [] }));
  return res.rows;
}

async function getSP500List() {
  const cached = await cache.get('stock:sp500:list').catch(() => null);
  if (cached) return JSON.parse(cached);
  const res = await query('SELECT ticker, company, sector FROM sp500_stocks ORDER BY ticker').catch(() => ({ rows: [] }));
  if (res.rows.length > 0) {
    await cache.setEx('stock:sp500:list', 3600, JSON.stringify(res.rows)).catch(() => {});
  }
  return res.rows;
}

async function getStockQuote(ticker) {
  return getQuote(ticker);
}

async function getStockHistory(ticker, range) {
  return getHistory(ticker, range);
}

async function ensureSP500Seeded() {
  const res = await query('SELECT COUNT(*) FROM sp500_stocks').catch(() => ({ rows: [{ count: '0' }] }));
  if (parseInt(res.rows[0].count) < 10) {
    const { fetchSP500 } = require('../scrapers/sp500List');
    await fetchSP500().catch(e => console.error('[stocks] SP500 seed failed:', e.message));
  }
}

module.exports = { searchStocks, getSP500List, getStockQuote, getStockHistory, ensureSP500Seeded };
