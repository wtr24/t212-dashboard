require('dotenv').config();
const axios = require('axios');

const KEY = process.env.T212_API_KEY;
const SECRET = process.env.T212_API_SECRET;

if (!KEY || !SECRET) {
  console.error('❌  T212_API_KEY and T212_API_SECRET must both be set in server/.env');
  process.exit(1);
}

const encoded = Buffer.from(`${KEY}:${SECRET}`).toString('base64');
const AUTH = `Basic ${encoded}`;
const BASE = 'https://live.trading212.com/api/v0';

const client = axios.create({
  baseURL: BASE,
  headers: { Authorization: AUTH, Accept: 'application/json' },
  timeout: 10000,
});

function ok(label, data) {
  console.log(`\n✅  ${label}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 500));
}

function fail(label, e) {
  console.log(`\n❌  ${label} — ${e.response?.status} ${JSON.stringify(e.response?.data)?.slice(0, 100)}`);
}

async function run() {
  console.log(`\nT212 API Test — Basic auth, live ISA\n${'─'.repeat(55)}`);

  const endpoints = [
    ['/equity/account/summary',       null],
    ['/equity/portfolio',             null],
    ['/equity/history/orders',        { limit: 3 }],
    ['/equity/history/dividends',     { limit: 3 }],
    ['/equity/history/transactions',  { limit: 3 }],
    ['/equity/pies',                  null],
  ];

  for (const [path, params] of endpoints) {
    try {
      const { data } = await client.get(path, params ? { params } : {});
      const preview = Array.isArray(data)
        ? { count: data.length, first: data[0] }
        : data?.items
          ? { count: data.items.length, first: data.items[0] }
          : data;
      ok(`GET ${path}`, preview);
    } catch (e) { fail(`GET ${path}`, e); }
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`\n${'─'.repeat(55)}\nDone.\n`);
}

run().catch(console.error);
