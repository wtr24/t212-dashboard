const { query } = require('../models/db');

const SAMPLE_TRADES = [
  { ticker: 'NVDA', company_name: 'NVIDIA Corporation', insider_name: 'Jensen Huang', title: 'CEO', trade_type: 'Sale', price: 875.50, qty: 120000, owned_after: 820000, delta_own_pct: -12.8, value: 105060000, trade_date: '2026-01-15', filing_date: '2026-01-17' },
  { ticker: 'TSLA', company_name: 'Tesla Inc', insider_name: 'Elon Musk', title: 'CEO', trade_type: 'Sale', price: 312.40, qty: 500000, owned_after: 411000000, delta_own_pct: -0.1, value: 156200000, trade_date: '2026-01-20', filing_date: '2026-01-22' },
  { ticker: 'AAPL', company_name: 'Apple Inc', insider_name: 'Tim Cook', title: 'CEO', trade_type: 'Sale', price: 235.10, qty: 511000, owned_after: 3200000, delta_own_pct: -13.8, value: 120156100, trade_date: '2026-01-28', filing_date: '2026-01-30' },
  { ticker: 'META', company_name: 'Meta Platforms Inc', insider_name: 'Mark Zuckerberg', title: 'CEO', trade_type: 'Sale', price: 610.20, qty: 200000, owned_after: 345000000, delta_own_pct: -0.1, value: 122040000, trade_date: '2026-02-03', filing_date: '2026-02-05' },
  { ticker: 'AMZN', company_name: 'Amazon.com Inc', insider_name: 'Andy Jassy', title: 'CEO', trade_type: 'Sale', price: 225.80, qty: 50000, owned_after: 950000, delta_own_pct: -5.0, value: 11290000, trade_date: '2026-02-10', filing_date: '2026-02-12' },
  { ticker: 'MSFT', company_name: 'Microsoft Corporation', insider_name: 'Satya Nadella', title: 'CEO', trade_type: 'Sale', price: 415.30, qty: 40000, owned_after: 780000, delta_own_pct: -4.9, value: 16612000, trade_date: '2026-02-12', filing_date: '2026-02-14' },
  { ticker: 'GOOGL', company_name: 'Alphabet Inc', insider_name: 'Sundar Pichai', title: 'CEO', trade_type: 'Sale', price: 180.50, qty: 75000, owned_after: 320000, delta_own_pct: -19.0, value: 13537500, trade_date: '2026-02-15', filing_date: '2026-02-17' },
  { ticker: 'JPM', company_name: 'JPMorgan Chase & Co', insider_name: 'Jamie Dimon', title: 'CEO', trade_type: 'Sale', price: 248.90, qty: 800000, owned_after: 7200000, delta_own_pct: -10.0, value: 199120000, trade_date: '2026-02-18', filing_date: '2026-02-20' },
  { ticker: 'AXTI', company_name: 'AXT Inc', insider_name: 'Chen Jesse', title: 'Dir', trade_type: 'Sale', price: 37.54, qty: 14452, owned_after: 152612, delta_own_pct: -9.0, value: 542595, trade_date: '2026-03-06', filing_date: '2026-03-10' },
  { ticker: 'ISRG', company_name: 'Intuitive Surgical Inc', insider_name: 'Brosius Mark', title: 'SVP', trade_type: 'Sale', price: 487.61, qty: 1293, owned_after: 1613, delta_own_pct: -44.0, value: 630475, trade_date: '2026-03-06', filing_date: '2026-03-10' },
  { ticker: 'ORCL', company_name: 'Oracle Corporation', insider_name: 'Larry Ellison', title: 'CTO', trade_type: 'Sale', price: 178.40, qty: 1000000, owned_after: 40000000, delta_own_pct: -2.4, value: 178400000, trade_date: '2026-02-20', filing_date: '2026-02-22' },
  { ticker: 'AMD', company_name: 'Advanced Micro Devices', insider_name: 'Lisa Su', title: 'CEO', trade_type: 'Sale', price: 112.30, qty: 25000, owned_after: 680000, delta_own_pct: -3.5, value: 2807500, trade_date: '2026-02-22', filing_date: '2026-02-24' },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', insider_name: 'Alexander Karp', title: 'CEO', trade_type: 'Sale', price: 82.50, qty: 2000000, owned_after: 78000000, delta_own_pct: -2.5, value: 165000000, trade_date: '2026-02-25', filing_date: '2026-02-27' },
  { ticker: 'NFLX', company_name: 'Netflix Inc', insider_name: 'Reed Hastings', title: 'Dir', trade_type: 'Sale', price: 998.20, qty: 5000, owned_after: 280000, delta_own_pct: -1.8, value: 4991000, trade_date: '2026-03-01', filing_date: '2026-03-03' },
  { ticker: 'CRM', company_name: 'Salesforce Inc', insider_name: 'Marc Benioff', title: 'CEO', trade_type: 'Sale', price: 312.80, qty: 15000, owned_after: 3200000, delta_own_pct: -0.5, value: 4692000, trade_date: '2026-03-03', filing_date: '2026-03-05' },
];

async function seedIfEmpty() {
  const res = await query('SELECT COUNT(*) FROM insider_trades').catch(() => ({ rows: [{ count: '0' }] }));
  const count = parseInt(res.rows[0].count);
  if (count >= 10) return { seeded: 0 };
  console.log(`[insider] Seeding sample trades (current count: ${count})...`);
  let seeded = 0;
  for (const t of SAMPLE_TRADES) {
    await query(
      `INSERT INTO insider_trades
        (ticker, company_name, insider_name, title, trade_type,
         price, qty, owned_after, delta_own_pct, value,
         trade_date, filing_date, source, raw_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT ON CONSTRAINT insider_trades_unique_key DO NOTHING`,
      [t.ticker, t.company_name, t.insider_name, t.title, t.trade_type,
       t.price, t.qty, t.owned_after, t.delta_own_pct, t.value,
       t.trade_date, t.filing_date, 'seed', JSON.stringify(t)]
    ).catch(() => {});
    seeded++;
  }
  return { seeded };
}

module.exports = { seedIfEmpty };
