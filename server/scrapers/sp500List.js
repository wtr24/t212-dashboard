const axios = require('axios');
const { query } = require('../models/db');

const CSV_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv';

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g,''));
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    return obj;
  });
}

async function fetchSP500() {
  const res = await axios.get(CSV_URL, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const rows = parseCSV(res.data);
  let upserted = 0;
  for (const row of rows) {
    const ticker = (row.Symbol || row.Ticker || '').toUpperCase().trim();
    if (!ticker) continue;
    await query(
      `INSERT INTO sp500_stocks (ticker, company, sector, sub_industry, last_updated)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (ticker) DO UPDATE SET company=$2, sector=$3, sub_industry=$4, last_updated=NOW()`,
      [ticker, row['Security'] || row.Company || '', row['GICS Sector'] || row.Sector || '', row['GICS Sub-Industry'] || '']
    ).catch(() => {});
    upserted++;
  }
  return { upserted, total: rows.length };
}

module.exports = { fetchSP500 };
