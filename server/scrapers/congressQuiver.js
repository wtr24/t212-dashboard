const axios = require('axios');
const { query } = require('../models/db');

const API_URL = 'https://api.quiverquant.com/beta/live/congresstrading';

function parseAmountRange(range) {
  if (!range) return { min: 0, max: 0 };
  const nums = range.replace(/[$,\s]/g, '').match(/\d+/g);
  if (!nums || nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: parseInt(nums[0]), max: parseInt(nums[0]) };
  return { min: parseInt(nums[0]), max: parseInt(nums[1]) };
}

function normalizeType(t) {
  if (!t) return 'Other';
  const lower = t.toLowerCase();
  if (lower.includes('purchase')) return 'Purchase';
  if (lower.includes('sale') || lower.includes('sell')) return 'Sale';
  if (lower.includes('exchange')) return 'Exchange';
  return t;
}

function normalizeAssetType(t) {
  if (!t) return 'Stock';
  const lower = t.toLowerCase();
  if (lower.includes('etf') || lower.includes('fund')) return 'ETF';
  if (lower.includes('bond') || lower.includes('treasury')) return 'Bond';
  if (lower.includes('crypto') || lower.includes('bitcoin')) return 'Crypto';
  if (lower.includes('option')) return 'Option';
  return 'Stock';
}

function toISO(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

async function upsertTrade(t) {
  const { min, max } = parseAmountRange(t.Range);
  const ticker = (t.Ticker || '').toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 20) || null;
  const res = await query(
    `INSERT INTO congress_trades
      (member_name, chamber, party, state, ticker, asset_name, asset_type,
       transaction_type, amount_range, amount_min, amount_max,
       transaction_date, disclosure_date, source, raw_data, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
     ON CONFLICT (member_name, ticker, transaction_date, transaction_type, amount_range)
     DO UPDATE SET updated_at=NOW(), raw_data=EXCLUDED.raw_data, amount_min=EXCLUDED.amount_min, amount_max=EXCLUDED.amount_max
     RETURNING id, xmax`,
    [
      t.Representative || 'Unknown',
      t.House || null,
      t.Party || null,
      null,
      ticker,
      t.Description || null,
      normalizeAssetType(t.TickerType),
      normalizeType(t.Transaction),
      t.Range || null,
      min, max,
      toISO(t.TransactionDate),
      toISO(t.ReportDate),
      'quiverquant',
      JSON.stringify(t),
    ]
  );
  return res.rows[0];
}

async function run() {
  const start = new Date();
  let found = 0, inserted = 0, updated = 0;

  const logRun = async (error) => {
    await query(
      `INSERT INTO scraper_runs (source, started_at, completed_at, records_found, records_inserted, records_updated, error, duration_ms)
       VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7)`,
      ['quiverquant', start, found, inserted, updated, error, Date.now() - start.getTime()]
    ).catch(() => {});
  };

  try {
    const res = await axios.get(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Authorization': 'Token guest',
      },
      timeout: 20000,
    });

    const rows = Array.isArray(res.data) ? res.data : [];
    found = rows.length;

    for (const row of rows) {
      if (!row.Representative || !row.Ticker) continue;
      const r = await upsertTrade(row).catch(() => null);
      if (r) {
        if (r.xmax === '0') inserted++;
        else updated++;
      }
    }

    await logRun(null);
    return { source: 'quiverquant', found, inserted, updated };
  } catch (e) {
    await logRun(e.message);
    throw e;
  }
}

module.exports = { run };
