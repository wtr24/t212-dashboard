const { query } = require('../models/db');
const cache = require('./cache');

const CACHE_TTL = 60;

async function getRecentTrades(filters = {}) {
  const cacheKey = `congress:trades:${JSON.stringify(filters)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const conditions = [];
  const params = [];
  let i = 1;

  if (filters.member) { conditions.push(`member_name ILIKE $${i++}`); params.push(`%${filters.member}%`); }
  if (filters.ticker) { conditions.push(`ticker ILIKE $${i++}`); params.push(`%${filters.ticker}%`); }
  if (filters.type && filters.type !== 'ALL') { conditions.push(`transaction_type = $${i++}`); params.push(filters.type); }
  if (filters.chamber && filters.chamber !== 'ALL') { conditions.push(`chamber = $${i++}`); params.push(filters.chamber); }
  if (filters.party && filters.party !== 'ALL') { conditions.push(`party = $${i++}`); params.push(filters.party); }
  if (filters.asset && filters.asset !== 'ALL') { conditions.push(`asset_type = $${i++}`); params.push(filters.asset); }
  if (filters.from) { conditions.push(`transaction_date >= $${i++}`); params.push(filters.from); }
  if (filters.to) { conditions.push(`transaction_date <= $${i++}`); params.push(filters.to); }
  if (filters.minAmount) { conditions.push(`amount_min >= $${i++}`); params.push(parseInt(filters.minAmount)); }
  if (filters.maxAmount) { conditions.push(`amount_max <= $${i++}`); params.push(parseInt(filters.maxAmount)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(parseInt(filters.limit) || 25, 100);
  const offset = (parseInt(filters.page) - 1 || 0) * limit;

  const [dataRes, countRes] = await Promise.all([
    query(`SELECT * FROM congress_trades ${where} ORDER BY transaction_date DESC, created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]),
    query(`SELECT COUNT(*) FROM congress_trades ${where}`, params),
  ]);

  const result = {
    trades: dataRes.rows,
    total: parseInt(countRes.rows[0].count),
    page: parseInt(filters.page) || 1,
    limit,
    pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
  };
  await cache.set(cacheKey, JSON.stringify(result), CACHE_TTL);
  return result;
}

async function getStats() {
  const cached = await cache.get('congress:stats');
  if (cached) return JSON.parse(cached);

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [total, todayRes, weekRes, activeMember, activeTicker, lastRun] = await Promise.all([
    query('SELECT COUNT(*) FROM congress_trades'),
    query(`SELECT COUNT(*) FROM congress_trades WHERE transaction_date = $1`, [today]),
    query(`SELECT COUNT(*) FROM congress_trades WHERE transaction_date >= $1`, [weekAgo]),
    query(`SELECT member_name, COUNT(*) as c FROM congress_trades GROUP BY member_name ORDER BY c DESC LIMIT 1`),
    query(`SELECT ticker, COUNT(*) as c FROM congress_trades WHERE ticker IS NOT NULL GROUP BY ticker ORDER BY c DESC LIMIT 1`),
    query(`SELECT completed_at, records_found, records_inserted, source, error FROM scraper_runs ORDER BY completed_at DESC LIMIT 1`),
  ]);

  const result = {
    totalTrades: parseInt(total.rows[0].count),
    tradesToday: parseInt(todayRes.rows[0].count),
    tradesThisWeek: parseInt(weekRes.rows[0].count),
    mostActiveMember: activeMember.rows[0]?.member_name || null,
    mostTradedTicker: activeTicker.rows[0]?.ticker || null,
    lastScraperRun: lastRun.rows[0] || null,
  };
  await cache.set('congress:stats', JSON.stringify(result), CACHE_TTL);
  return result;
}

async function getMembers() {
  const cached = await cache.get('congress:members');
  if (cached) return JSON.parse(cached);
  const res = await query('SELECT DISTINCT member_name, party, chamber, state FROM congress_trades ORDER BY member_name');
  await cache.set('congress:members', JSON.stringify(res.rows), 300);
  return res.rows;
}

async function getTickers() {
  const cached = await cache.get('congress:tickers');
  if (cached) return JSON.parse(cached);
  const res = await query(`SELECT DISTINCT ticker, asset_name FROM congress_trades WHERE ticker IS NOT NULL ORDER BY ticker`);
  await cache.set('congress:tickers', JSON.stringify(res.rows), 300);
  return res.rows;
}

async function getMemberTrades(memberName) {
  const res = await query(
    `SELECT * FROM congress_trades WHERE member_name ILIKE $1 ORDER BY transaction_date DESC`,
    [`%${memberName}%`]
  );
  const trades = res.rows;
  const totalBuy = trades.filter(t => t.transaction_type === 'Purchase').reduce((s, t) => s + (parseInt(t.amount_max) || 0), 0);
  const totalSell = trades.filter(t => t.transaction_type === 'Sale').reduce((s, t) => s + (parseInt(t.amount_max) || 0), 0);
  const tickers = {};
  trades.forEach(t => { if (t.ticker) tickers[t.ticker] = (tickers[t.ticker] || 0) + 1; });
  const topTicker = Object.entries(tickers).sort((a,b) => b[1]-a[1])[0]?.[0] || null;
  return { trades, stats: { total: trades.length, totalBuy, totalSell, topTicker } };
}

async function getScraperStatus() {
  const res = await query(
    `SELECT source, MAX(completed_at) as last_run, SUM(records_found) as total_found, MAX(error) as last_error
     FROM scraper_runs WHERE started_at > NOW() - INTERVAL '24 hours'
     GROUP BY source`
  );
  return res.rows;
}

async function invalidateCache() {
  await cache.del('congress:stats');
  await cache.del('congress:members');
  await cache.del('congress:tickers');
}

module.exports = { getRecentTrades, getStats, getMembers, getTickers, getMemberTrades, getScraperStatus, invalidateCache };
