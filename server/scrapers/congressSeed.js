const { query } = require('../models/db');

const SAMPLE_TRADES = [
  { member_name: 'Nancy Pelosi', chamber: 'House', party: 'D', state: 'CA', ticker: 'NVDA', asset_name: 'NVIDIA Corporation', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$1,000,001-$5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2025-01-15', disclosure_date: '2025-01-28' },
  { member_name: 'Nancy Pelosi', chamber: 'House', party: 'D', state: 'CA', ticker: 'AAPL', asset_name: 'Apple Inc.', asset_type: 'Stock', transaction_type: 'Sale', amount_range: '$500,001-$1,000,000', amount_min: 500001, amount_max: 1000000, transaction_date: '2025-01-20', disclosure_date: '2025-02-02' },
  { member_name: 'Nancy Pelosi', chamber: 'House', party: 'D', state: 'CA', ticker: 'MSFT', asset_name: 'Microsoft Corporation', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$250,001-$500,000', amount_min: 250001, amount_max: 500000, transaction_date: '2025-02-10', disclosure_date: '2025-02-24' },
  { member_name: 'Dan Crenshaw', chamber: 'House', party: 'R', state: 'TX', ticker: 'XOM', asset_name: 'Exxon Mobil Corporation', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$15,001-$50,000', amount_min: 15001, amount_max: 50000, transaction_date: '2025-01-08', disclosure_date: '2025-01-22' },
  { member_name: 'Tommy Tuberville', chamber: 'Senate', party: 'R', state: 'AL', ticker: 'LMT', asset_name: 'Lockheed Martin Corporation', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$50,001-$100,000', amount_min: 50001, amount_max: 100000, transaction_date: '2025-01-12', disclosure_date: '2025-01-30' },
  { member_name: 'Tommy Tuberville', chamber: 'Senate', party: 'R', state: 'AL', ticker: 'RTX', asset_name: 'Raytheon Technologies', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$50,001-$100,000', amount_min: 50001, amount_max: 100000, transaction_date: '2025-01-12', disclosure_date: '2025-01-30' },
  { member_name: 'Josh Gottheimer', chamber: 'House', party: 'D', state: 'NJ', ticker: 'GOOGL', asset_name: 'Alphabet Inc.', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$100,001-$250,000', amount_min: 100001, amount_max: 250000, transaction_date: '2025-01-22', disclosure_date: '2025-02-04' },
  { member_name: 'Josh Gottheimer', chamber: 'House', party: 'D', state: 'NJ', ticker: 'META', asset_name: 'Meta Platforms Inc.', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$50,001-$100,000', amount_min: 50001, amount_max: 100000, transaction_date: '2025-01-22', disclosure_date: '2025-02-04' },
  { member_name: 'Marjorie Taylor Greene', chamber: 'House', party: 'R', state: 'GA', ticker: 'TSLA', asset_name: 'Tesla Inc.', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$15,001-$50,000', amount_min: 15001, amount_max: 50000, transaction_date: '2025-01-28', disclosure_date: '2025-02-10' },
  { member_name: 'Mark Warner', chamber: 'Senate', party: 'D', state: 'VA', ticker: 'AMZN', asset_name: 'Amazon.com Inc.', asset_type: 'Stock', transaction_type: 'Sale', amount_range: '$1,000,001-$5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2025-02-05', disclosure_date: '2025-02-18' },
  { member_name: 'Mark Warner', chamber: 'Senate', party: 'D', state: 'VA', ticker: 'AMD', asset_name: 'Advanced Micro Devices', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$100,001-$250,000', amount_min: 100001, amount_max: 250000, transaction_date: '2025-02-12', disclosure_date: '2025-02-26' },
  { member_name: 'Pete Aguilar', chamber: 'House', party: 'D', state: 'CA', ticker: 'NVDA', asset_name: 'NVIDIA Corporation', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$50,001-$100,000', amount_min: 50001, amount_max: 100000, transaction_date: '2025-02-18', disclosure_date: '2025-03-03' },
  { member_name: 'Bill Hagerty', chamber: 'Senate', party: 'R', state: 'TN', ticker: 'JPM', asset_name: 'JPMorgan Chase & Co.', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$250,001-$500,000', amount_min: 250001, amount_max: 500000, transaction_date: '2025-02-20', disclosure_date: '2025-03-05' },
  { member_name: 'Dan Crenshaw', chamber: 'House', party: 'R', state: 'TX', ticker: 'CVX', asset_name: 'Chevron Corporation', asset_type: 'Stock', transaction_type: 'Purchase', amount_range: '$15,001-$50,000', amount_min: 15001, amount_max: 50000, transaction_date: '2025-02-25', disclosure_date: '2025-03-07' },
  { member_name: 'Ro Khanna', chamber: 'House', party: 'D', state: 'CA', ticker: 'INTC', asset_name: 'Intel Corporation', asset_type: 'Stock', transaction_type: 'Sale', amount_range: '$1,001-$15,000', amount_min: 1001, amount_max: 15000, transaction_date: '2025-03-01', disclosure_date: '2025-03-08' },
];

async function seedIfEmpty() {
  const res = await query('SELECT COUNT(*) FROM congress_trades').catch(() => ({ rows: [{ count: '0' }] }));
  const count = parseInt(res.rows[0].count);
  if (count >= 10) return { seeded: 0 };
  console.log(`[congress] Seeding sample trades (current count: ${count})...`);
  let seeded = 0;
  for (const t of SAMPLE_TRADES) {
    await query(
      `INSERT INTO congress_trades
        (member_name, chamber, party, state, ticker, asset_name, asset_type,
         transaction_type, amount_range, amount_min, amount_max,
         transaction_date, disclosure_date, source, raw_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT ON CONSTRAINT congress_trades_unique_key DO NOTHING`,
      [t.member_name, t.chamber, t.party, t.state, t.ticker, t.asset_name, t.asset_type,
       t.transaction_type, t.amount_range, t.amount_min, t.amount_max,
       t.transaction_date, t.disclosure_date, 'seed', JSON.stringify(t)]
    ).catch(() => {});
    seeded++;
  }
  return { seeded };
}

module.exports = { seedIfEmpty };
