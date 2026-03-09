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
  console.log('Refresh jobs started');
}

module.exports = { startJobs };
