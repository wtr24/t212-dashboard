const axios = require('axios');
const { query } = require('../models/db');

const API_URL = 'https://api.quiverquant.com/beta/live/congresstrading';
const MAX_RETRIES = 3;

function parseAmountRange(range) {
  if (!range) return { min: 0, max: 0 };
  const nums = range.replace(/[$,\s]/g, '').match(/\d+/g);
  if (!nums || nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: parseInt(nums[0]), max: parseInt(nums[0]) };
  return { min: parseInt(nums[0]), max: parseInt(nums[1]) };
}

function normalizeType(t) {
  if (!t) return 'Other';
  const l = t.toLowerCase();
  if (l.includes('purchase')) return 'Purchase';
  if (l.includes('sale') || l.includes('sell')) return 'Sale';
  if (l.includes('exchange')) return 'Exchange';
  return t;
}

function normalizeAssetType(t) {
  if (!t) return 'Stock';
  const l = t.toLowerCase();
  if (l.includes('etf') || l.includes('fund')) return 'ETF';
  if (l.includes('bond') || l.includes('treasury')) return 'Bond';
  if (l.includes('crypto') || l.includes('bitcoin')) return 'Crypto';
  if (l.includes('option')) return 'Option';
  return 'Stock';
}

function toISO(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

async function fetchWithRetry() {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.get(API_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        timeout: 20000,
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      console.log(`[congress] Quiverquant fetch attempt ${attempt}: ${rows.length} rows`);
      return rows;
    } catch (e) {
      lastErr = e;
      console.error(`[congress] Quiverquant attempt ${attempt}/${MAX_RETRIES} failed: ${e.response?.status || e.message}`);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
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
     ON CONFLICT ON CONSTRAINT congress_trades_unique_key
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
  let found = 0, inserted = 0, updated = 0, errors = 0;

  const logRun = async (error) => {
    await query(
      `INSERT INTO scraper_runs (source, started_at, completed_at, records_found, records_inserted, records_updated, error, duration_ms)
       VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7)`,
      ['quiverquant', start, found, inserted, updated, error, Date.now() - start.getTime()]
    ).catch(e => console.error('[congress] logRun failed:', e.message));
  };

  try {
    console.log('[congress] Quiverquant scraper starting...');
    const rows = await fetchWithRetry();
    found = rows.length;
    console.log(`[congress] Processing ${found} rows...`);

    for (const row of rows) {
      if (!row.Representative || !row.Ticker) continue;
      try {
        const r = await upsertTrade(row);
        if (r) {
          if (r.xmax === '0') inserted++;
          else updated++;
        }
      } catch (e) {
        errors++;
        if (errors <= 3) console.error(`[congress] upsert error for ${row.Ticker}:`, e.message);
      }
    }

    console.log(`[congress] Done: found=${found} inserted=${inserted} updated=${updated} errors=${errors}`);
    await logRun(null);
    return { source: 'quiverquant', found, inserted, updated, errors };
  } catch (e) {
    console.error('[congress] Scraper failed:', e.message);
    await logRun(e.message);
    throw e;
  }
}

module.exports = { run };
