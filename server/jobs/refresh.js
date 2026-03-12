const cron = require('node-cron');
const t212 = require('../services/t212');
const { enrichPositions } = require('../services/marketData');
const { getAllSentiment } = require('../services/community');
const { analyseTop10 } = require('../services/aiAnalysis');
const cache = require('../services/cache');
const { query } = require('../models/db');

async function logJob(name, status, records, error) {
  await query(
    'INSERT INTO job_runs (job_name, status, records_affected, error_message) VALUES ($1,$2,$3,$4)',
    [name, status, records, error]
  ).catch(() => {});
}

async function refreshPortfolio() {
  try {
    await cache.del('t212:portfolio');
    await cache.del('t212:summary');
    const result = await t212.getPortfolio();
    const positions = result.data || [];
    await logJob('refresh_portfolio', 'success', positions.length, null);
  } catch (e) { await logJob('refresh_portfolio', 'error', 0, e.message); }
}

async function refreshMarket() {
  try {
    const result = await t212.getPortfolio();
    const positions = result.data || [];
    await enrichPositions(positions);
    await logJob('refresh_market', 'success', positions.length, null);
  } catch (e) { await logJob('refresh_market', 'error', 0, e.message); }
}

async function refreshCommunity() {
  try {
    const result = await t212.getPortfolio();
    const positions = result.data || [];
    const tickers = positions.map(p => p.ticker);
    await getAllSentiment(tickers);
    await logJob('refresh_community', 'success', tickers.length, null);
  } catch (e) { await logJob('refresh_community', 'error', 0, e.message); }
}

async function refreshAnalysis() {
  try {
    const result = await t212.getPortfolio();
    const positions = result.data || [];
    const { enrichPositions: ep } = require('../services/marketData');
    const enriched = await ep(positions);
    await analyseTop10(positions, enriched);
    await logJob('refresh_analysis', 'success', Math.min(10, positions.length), null);
  } catch (e) { await logJob('refresh_analysis', 'error', 0, e.message); }
}

function startJobs() {
  cron.schedule('*/30 * * * * *', refreshPortfolio);
  cron.schedule('*/5 * * * *', refreshMarket);
  cron.schedule('*/15 * * * *', refreshCommunity);
  cron.schedule('0 * * * *', refreshAnalysis);
  cron.schedule('0 8 * * *', async () => {
    await cache.del('t212:transactions');
    await t212.getTransactions();
  });
  cron.schedule('*/5 * * * *', async () => {
    const { scheduleIfDue } = require('./congressScraper');
    await scheduleIfDue().catch(e => console.error('[congress cron]', e.message));
  });
  cron.schedule('*/5 * * * *', async () => {
    const { scheduleIfDue: insiderDue } = require('./insiderScraper');
    await insiderDue().catch(e => console.error('[insider cron]', e.message));
  });
  cron.schedule('0 */6 * * *', async () => {
    const { runEarningsScraper } = require('../scrapers/earningsCalendar');
    runEarningsScraper().catch(e => console.error('[earnings cron]', e.message));
  });
  // Daily enrichment pass for revenue/market_cap/analyst fields at 6am
  cron.schedule('0 6 * * *', async () => {
    const { enrichEarningsFromYahoo } = require('../scrapers/earningsCalendar');
    enrichEarningsFromYahoo().catch(e => console.error('[earnings enrich cron]', e.message));
  });
  cron.schedule('*/30 * * * *', async () => {
    const { runActualsUpdater } = require('../scrapers/earningsActuals');
    runActualsUpdater().catch(e => console.error('[earnings actuals cron]', e.message));
  });
  // Technical analysis: every hour during market hours Mon-Fri 9am-5pm London
  cron.schedule('0 9-17 * * 1-5', async () => {
    const { analysePortfolio } = require('../services/technicalAnalysis');
    try {
      const result = await t212.getPortfolio();
      const positions = result.data || [];
      const tickers = [...new Set(positions.map(p => {
        return (p.ticker || '').replace(/[_](US|UK|EQ|NASDAQ|NYSE|LSE|ALL)[_A-Z0-9]*/g, '').split('_')[0] || p.ticker;
      }).filter(Boolean))];
      if (tickers.length) {
        console.log(`[TA] Scheduled refresh for ${tickers.length} tickers`);
        analysePortfolio(tickers).catch(e => console.error('[TA] refresh failed:', e.message));
      }
    } catch (e) { console.error('[TA] cron failed:', e.message); }
  });
  // Earnings actuals: poll every 5 min during market hours Mon-Fri 7am-8pm London
  cron.schedule('*/5 7-20 * * 1-5', async () => {
    const { pollEarningsActuals } = require('../scrapers/earningsActuals');
    pollEarningsActuals().catch(e => console.error('[actuals cron]', e.message));
  });
  console.log('Refresh jobs started');
}

module.exports = { startJobs };
