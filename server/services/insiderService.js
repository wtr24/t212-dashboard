const { query } = require('../models/db');
const cache = require('./cache');

const CACHE_TTL = 60;

async function getRecentTrades(filters = {}) {
  const cacheKey = `insider:trades:${JSON.stringify(filters)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const conditions = [];
  const params = [];
  let i = 1;

  if (filters.ticker) { conditions.push(`ticker ILIKE $${i++}`); params.push(`%${filters.ticker}%`); }
  if (filters.insider) { conditions.push(`insider_name ILIKE $${i++}`); params.push(`%${filters.insider}%`); }
  if (filters.type && filters.type !== 'ALL') { conditions.push(`trade_type = $${i++}`); params.push(filters.type); }
  if (filters.from) { conditions.push(`trade_date >= $${i++}`); params.push(filters.from); }
  if (filters.to) { conditions.push(`trade_date <= $${i++}`); params.push(filters.to); }
  if (filters.minValue) { conditions.push(`value >= $${i++}`); params.push(parseFloat(filters.minValue)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(parseInt(filters.limit) || 25, 100);
  const offset = (parseInt(filters.page) - 1 || 0) * limit;

  const [dataRes, countRes] = await Promise.all([
    query(`SELECT * FROM insider_trades ${where} ORDER BY trade_date DESC, filing_date DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]),
    query(`SELECT COUNT(*) FROM insider_trades ${where}`, params),
  ]);

  const result = {
    trades: dataRes.rows,
    total: parseInt(countRes.rows[0].count),
    page: parseInt(filters.page) || 1,
    limit,
    pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
  };
  await cache.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
  return result;
}

async function getStats() {
  const cached = await cache.get('insider:stats');
  if (cached) return JSON.parse(cached);

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [total, todayRes, weekRes, biggestSale, biggestBuy, topInsider, lastRun] = await Promise.all([
    query('SELECT COUNT(*) FROM insider_trades'),
    query(`SELECT COUNT(*) FROM insider_trades WHERE filing_date = $1`, [today]),
    query(`SELECT COUNT(*) FROM insider_trades WHERE trade_date >= $1`, [weekAgo]),
    query(`SELECT ticker, insider_name, value FROM insider_trades WHERE trade_type='Sale' ORDER BY value DESC LIMIT 1`),
    query(`SELECT ticker, insider_name, value FROM insider_trades WHERE trade_type='Purchase' ORDER BY value DESC LIMIT 1`),
    query(`SELECT insider_name, COUNT(*) as c FROM insider_trades GROUP BY insider_name ORDER BY c DESC LIMIT 1`),
    query(`SELECT completed_at, records_found, records_inserted, source, error FROM insider_scraper_runs ORDER BY completed_at DESC LIMIT 1`),
  ]);

  const result = {
    totalTrades: parseInt(total.rows[0].count),
    tradesToday: parseInt(todayRes.rows[0].count),
    tradesThisWeek: parseInt(weekRes.rows[0].count),
    biggestSale: biggestSale.rows[0] || null,
    biggestBuy: biggestBuy.rows[0] || null,
    mostActiveInsider: topInsider.rows[0]?.insider_name || null,
    lastScraperRun: lastRun.rows[0] || null,
  };
  await cache.setEx('insider:stats', CACHE_TTL, JSON.stringify(result));
  return result;
}

async function getInsiders() {
  const cached = await cache.get('insider:insiders');
  if (cached) return JSON.parse(cached);
  const res = await query('SELECT DISTINCT insider_name, title FROM insider_trades ORDER BY insider_name');
  await cache.setEx('insider:insiders', 300, JSON.stringify(res.rows));
  return res.rows;
}

async function getTickers() {
  const cached = await cache.get('insider:tickers');
  if (cached) return JSON.parse(cached);
  const res = await query('SELECT DISTINCT ticker, company_name FROM insider_trades ORDER BY ticker');
  await cache.setEx('insider:tickers', 300, JSON.stringify(res.rows));
  return res.rows;
}

async function getInsiderProfile(insiderName) {
  const res = await query(
    `SELECT * FROM insider_trades WHERE insider_name ILIKE $1 ORDER BY trade_date DESC`,
    [`%${insiderName}%`]
  );
  const trades = res.rows;
  const totalBuy = trades.filter(t => t.trade_type === 'Purchase').reduce((s, t) => s + (parseFloat(t.value) || 0), 0);
  const totalSell = trades.filter(t => t.trade_type === 'Sale').reduce((s, t) => s + (parseFloat(t.value) || 0), 0);
  const tickers = {};
  trades.forEach(t => { if (t.ticker) tickers[t.ticker] = (tickers[t.ticker] || 0) + 1; });
  const topTicker = Object.entries(tickers).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { trades, stats: { total: trades.length, totalBuy, totalSell, topTicker } };
}

async function getScraperStatus() {
  const res = await query(
    `SELECT source, MAX(completed_at) as last_run, SUM(records_found) as total_found, MAX(error) as last_error
     FROM insider_scraper_runs WHERE started_at > NOW() - INTERVAL '24 hours'
     GROUP BY source`
  );
  return res.rows;
}

async function invalidateCache() {
  await cache.del('insider:stats');
  await cache.del('insider:insiders');
  await cache.del('insider:tickers');
}

module.exports = { getRecentTrades, getStats, getInsiders, getTickers, getInsiderProfile, getScraperStatus, invalidateCache };
