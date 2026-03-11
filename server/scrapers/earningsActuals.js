const axios = require('axios');
const { updateActuals } = require('../services/earningsService');
const { query } = require('../models/db');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchActuals(ticker) {
  try {
    const res = await axios.get(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}`, {
      params: { modules: 'earnings,financialData' },
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      timeout: 12000,
    });
    return res.data?.quoteSummary?.result?.[0] || null;
  } catch { return null; }
}

async function runActualsUpdater() {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await query(
    `SELECT ticker, report_date FROM earnings_calendar WHERE status='upcoming' AND report_date<=$1`,
    [today]
  ).catch(() => ({ rows: [] }));

  if (!rows.length) return { updated: 0 };

  let updated = 0;
  for (const row of rows) {
    const data = await fetchActuals(row.ticker);
    if (!data) { await sleep(300); continue; }

    const quarterly = data.earnings?.earningsChart?.quarterly || [];
    if (!quarterly.length) { await sleep(300); continue; }

    const latest = quarterly[quarterly.length - 1];
    if (latest?.actual?.raw != null) {
      const revAct = data.financialData?.totalRevenue?.raw || null;
      await updateActuals(row.ticker, row.report_date, latest.actual.raw, revAct);
      console.log(`[earnings] Actuals updated: ${row.ticker} EPS=${latest.actual.raw}`);
      updated++;
    }
    await sleep(500);
  }
  return { updated };
}

module.exports = { runActualsUpdater };
