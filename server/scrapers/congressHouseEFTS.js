const axios = require('axios');
const { query } = require('../models/db');

const BASE_URL = 'https://efts.house.gov/LATEST/search-index';

function parseAmount(range) {
  if (!range) return { min: 0, max: 0 };
  const nums = range.replace(/[$,]/g, '').match(/\d+/g);
  if (!nums || nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: parseInt(nums[0]), max: parseInt(nums[0]) };
  return { min: parseInt(nums[0]), max: parseInt(nums[1]) };
}

function inferAssetType(name) {
  if (!name) return 'Other';
  const n = name.toLowerCase();
  if (n.includes('etf') || n.includes('fund') || n.includes('trust')) return 'ETF';
  if (n.includes('bond') || n.includes('treasury') || n.includes('note')) return 'Bond';
  if (n.includes('crypto') || n.includes('bitcoin') || n.includes('ethereum')) return 'Crypto';
  if (n.includes('option') || n.includes('call') || n.includes('put')) return 'Option';
  return 'Stock';
}

async function upsertTrade(trade) {
  const { min, max } = parseAmount(trade.amount_range);
  const res = await query(
    `INSERT INTO congress_trades
      (member_name, chamber, party, state, ticker, asset_name, asset_type,
       transaction_type, amount_range, amount_min, amount_max,
       transaction_date, disclosure_date, source, source_url, raw_data, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
     ON CONFLICT (member_name, ticker, transaction_date, transaction_type, amount_range)
     DO UPDATE SET updated_at=NOW(), raw_data=EXCLUDED.raw_data
     RETURNING id, xmax`,
    [
      trade.member_name, 'House', trade.party || null, trade.state || null,
      trade.ticker || null, trade.asset_name || null,
      trade.asset_type || inferAssetType(trade.asset_name),
      trade.transaction_type || null, trade.amount_range || null,
      min, max,
      trade.transaction_date || null, trade.disclosure_date || null,
      'house_efts', trade.source_url || null, JSON.stringify(trade)
    ]
  );
  return res.rows[0];
}

async function logRun(source, start, found, inserted, updated, error) {
  await query(
    `INSERT INTO scraper_runs (source, started_at, completed_at, records_found, records_inserted, records_updated, error, duration_ms)
     VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7)`,
    [source, start, found, inserted, updated, error, Date.now() - start.getTime()]
  ).catch(() => {});
}

async function fetchPage(fromDate, toDate, offset = 0) {
  const url = `${BASE_URL}?q=&dateRange=custom&fromDate=${fromDate}&toDate=${toDate}&limit=100&offset=${offset}`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-tracker/1.0)' },
    timeout: 15000,
  });
  return Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
}

function toISO(date) {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

function mapRow(row) {
  const name = [row.First || row.first_name || '', row.Last || row.last_name || ''].filter(Boolean).join(' ') || row.name || row.Representative || '';
  const stateDst = row.StateDst || row.state_dst || row.district || '';
  const state = stateDst ? stateDst.split('-')[0] : (row.State || row.state || '');
  return {
    member_name: name,
    party: row.Party || row.party || null,
    state: state.slice(0, 2) || null,
    ticker: (row.Ticker || row.ticker || row.Asset || '').toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 20) || null,
    asset_name: row.AssetDescription || row.asset_description || row.Description || null,
    asset_type: row.AssetType || row.asset_type || null,
    transaction_type: row.Type || row.type || row.TransactionType || null,
    amount_range: row.Amount || row.amount || row.AmountRange || null,
    transaction_date: toISO(row.TransactionDate || row.transaction_date || row.Date),
    disclosure_date: toISO(row.DisclosureDate || row.disclosure_date || row.Filed),
    source_url: row.DocID ? `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${new Date().getFullYear()}/${row.DocID}.pdf` : null,
  };
}

async function run() {
  const start = new Date();
  let found = 0, inserted = 0, updated = 0;
  try {
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    let offset = 0;
    let batch;
    do {
      batch = await fetchPage(fromDate, toDate, offset);
      found += batch.length;
      for (const row of batch) {
        const mapped = mapRow(row);
        if (!mapped.member_name) continue;
        const r = await upsertTrade(mapped).catch(() => null);
        if (r) {
          if (r.xmax === '0') inserted++;
          else updated++;
        }
      }
      offset += 100;
    } while (batch.length === 100);

    await logRun('house_efts', start, found, inserted, updated, null);
    return { found, inserted, updated };
  } catch (e) {
    await logRun('house_efts', start, found, inserted, updated, e.message);
    throw e;
  }
}

module.exports = { run };
