const cache = require('../services/cache');

async function getPortfolioTickers() {
  try {
    const { query } = require('../models/db');
    const { rows } = await query('SELECT DISTINCT ticker FROM positions LIMIT 20');
    return rows.map(r => (r.ticker || '').replace(/[_](US|UK|EQ|NASDAQ|NYSE|LSE|ALL)[_A-Z0-9]*/g, '').split('_')[0]).filter(Boolean);
  } catch { return []; }
}

async function warmPortfolioCache() {
  const tickers = await getPortfolioTickers();
  if (!tickers.length) return;
  console.log(`[cache] Warming ${tickers.length} portfolio tickers`);
  try {
    const { getBulkStockData } = require('../services/batchCallOptimizer');
    await getBulkStockData(tickers, { batchSize: 3, delayMs: 600 });
    console.log(`[cache] Warm complete for: ${tickers.join(', ')}`);
  } catch (e) {
    console.log('[cache] Warm failed:', e.message);
  }
}

module.exports = { warmPortfolioCache, getPortfolioTickers };
