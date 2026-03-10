const axios = require('axios');
const cheerio = require('cheerio');
const { query } = require('../models/db');

const BASE_URL = 'http://openinsider.com/screener';
const MAX_RETRIES = 3;

// Purchase clusters: xp=1, xs=1 means both purchases and sales
// vl=100 = min value $100k to filter noise
const SCREENER_PARAMS = 's=&o=&pl=&ph=&ll=&lh=&fd=7&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&xs=1&vl=100&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=0&cnt=100&Action=screener';

function parsePrice(str) {
  if (!str) return null;
  const n = parseFloat(str.replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}

function parseQty(str) {
  if (!str) return null;
  const n = parseInt(str.replace(/[,\s+]/g, '').replace(/−/g, '-'));
  return isNaN(n) ? null : Math.abs(n);
}

function parseValue(str) {
  if (!str) return null;
  const n = parseFloat(str.replace(/[$,\s]/g, '').replace(/−/g, '-'));
  return isNaN(n) ? null : Math.abs(n);
}

function parseDeltaOwn(str) {
  if (!str) return null;
  const n = parseFloat(str.replace(/[%\s+]/g, '').replace(/−/g, '-'));
  return isNaN(n) ? null : n;
}

function parseTradeType(str) {
  if (!str) return 'Other';
  const l = str.toLowerCase();
  if (l.includes('purchase') || l.startsWith('p -') || l === 'p') return 'Purchase';
  if (l.includes('sale') || l.startsWith('s -') || l === 's') return 'Sale';
  if (l.includes('gift')) return 'Gift';
  if (l.includes('option') || l.includes('exercise')) return 'Option Exercise';
  return str.trim();
}

function toISO(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.trim());
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

async function fetchPage(params) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.get(`${BASE_URL}?${params}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'http://openinsider.com/',
        },
        timeout: 20000,
      });
      return res.data;
    } catch (e) {
      lastErr = e;
      console.error(`[insider] OpenInsider attempt ${attempt}/${MAX_RETRIES} failed: ${e.response?.status || e.message}`);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

function parseHTML(html) {
  const $ = cheerio.load(html);
  const trades = [];

  $('table.tinytable tbody tr').each((i, tr) => {
    const cells = [];
    $(tr).find('td').each((j, td) => cells.push($(td).text().trim()));
    if (cells.length < 13) return;

    const [, filingDate, tradeDate, ticker, companyName, insiderName, title, tradeType, price, qty, owned, deltaOwn, value] = cells;

    if (!ticker || !insiderName) return;

    trades.push({
      filing_date: toISO(filingDate),
      trade_date: toISO(tradeDate),
      ticker: ticker.toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 20),
      company_name: companyName || null,
      insider_name: insiderName || null,
      title: title || null,
      trade_type: parseTradeType(tradeType),
      price: parsePrice(price),
      qty: parseQty(qty),
      owned_after: parseQty(owned),
      delta_own_pct: parseDeltaOwn(deltaOwn),
      value: parseValue(value),
      raw: { filingDate, tradeDate, ticker, companyName, insiderName, title, tradeType, price, qty, owned, deltaOwn, value },
    });
  });

  return trades;
}

async function upsertTrade(t) {
  const res = await query(
    `INSERT INTO insider_trades
      (ticker, company_name, insider_name, title, trade_type,
       price, qty, owned_after, delta_own_pct, value,
       trade_date, filing_date, source, raw_data, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
     ON CONFLICT ON CONSTRAINT insider_trades_unique_key
     DO UPDATE SET updated_at=NOW(), raw_data=EXCLUDED.raw_data, price=EXCLUDED.price, value=EXCLUDED.value
     RETURNING id, xmax`,
    [
      t.ticker, t.company_name, t.insider_name, t.title, t.trade_type,
      t.price, t.qty, t.owned_after, t.delta_own_pct, t.value,
      t.trade_date, t.filing_date, 'openinsider', JSON.stringify(t.raw),
    ]
  );
  return res.rows[0];
}

async function run() {
  const start = new Date();
  let found = 0, inserted = 0, updated = 0, errors = 0;

  const logRun = async (error) => {
    await query(
      `INSERT INTO insider_scraper_runs (source, started_at, completed_at, records_found, records_inserted, records_updated, error, duration_ms)
       VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7)`,
      ['openinsider', start, found, inserted, updated, error, Date.now() - start.getTime()]
    ).catch(e => console.error('[insider] logRun failed:', e.message));
  };

  try {
    console.log('[insider] OpenInsider scraper starting...');
    const html = await fetchPage(SCREENER_PARAMS);
    const trades = parseHTML(html);
    found = trades.length;
    console.log(`[insider] Parsed ${found} trades from OpenInsider`);

    for (const t of trades) {
      if (!t.ticker || !t.insider_name || !t.trade_date) continue;
      try {
        const r = await upsertTrade(t);
        if (r) {
          if (r.xmax === '0') inserted++;
          else updated++;
        }
      } catch (e) {
        errors++;
        if (errors <= 3) console.error(`[insider] upsert error for ${t.ticker}:`, e.message);
      }
    }

    console.log(`[insider] Done: found=${found} inserted=${inserted} updated=${updated} errors=${errors}`);
    await logRun(null);
    return { source: 'openinsider', found, inserted, updated, errors };
  } catch (e) {
    console.error('[insider] Scraper failed:', e.message);
    await logRun(e.message);
    throw e;
  }
}

module.exports = { run };
