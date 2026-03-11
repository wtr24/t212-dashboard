require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./models/db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  const pkg = require('./package.json');
  let dbOk = false;
  let redisOk = false;
  try { const { query } = require('./models/db'); await query('SELECT 1'); dbOk = true; } catch {}
  try { const cache = require('./services/cache'); await cache.get('_ping'); redisOk = true; } catch {}
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now(), version: pkg.version, db: dbOk, redis: redisOk });
});

app.get('/api/health', async (req, res) => {
  const pkg = require('./package.json');
  let dbOk = false;
  let redisOk = false;
  try { const { query } = require('./models/db'); await query('SELECT 1'); dbOk = true; } catch {}
  try { const cache = require('./services/cache'); await cache.get('_ping'); redisOk = true; } catch {}
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now(), version: pkg.version, db: dbOk, redis: redisOk });
});

app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/pies', require('./routes/pies'));
app.use('/api/community', require('./routes/community'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/market', require('./routes/market'));
app.use('/api/refresh', require('./routes/refresh'));
app.use('/api/congress', require('./routes/congress'));
app.use('/api/insider', require('./routes/insider'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/earnings', require('./routes/earnings'));

// Settings CRUD
app.get('/api/settings', async (req, res) => {
  try {
    const { query } = require('./models/db');
    const { rows } = await query('SELECT key, value FROM app_settings ORDER BY key').catch(() => ({ rows: [] }));
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { query } = require('./models/db');
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await query(
        `INSERT INTO app_settings (key,value,updated_at) VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value=$2,updated_at=NOW()`,
        [key, String(value)]
      ).catch(() => {});
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 5002;

const { startJobs } = require('./jobs/refresh');

initDB().then(async () => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  startJobs();
  setTimeout(async () => {
    const { runAllScrapers } = require('./jobs/congressScraper');
    console.log('[congress] Running initial scrape...');
    runAllScrapers().catch(e => console.error('[congress] Initial scrape failed:', e.message));
  }, 5000);
  setTimeout(async () => {
    const { runAllScrapers: runInsiderScrapers } = require('./jobs/insiderScraper');
    console.log('[insider] Running initial scrape...');
    runInsiderScrapers().catch(e => console.error('[insider] Initial scrape failed:', e.message));
  }, 10000);
  setTimeout(async () => {
    const { ensureSP500Seeded } = require('./services/stockService');
    ensureSP500Seeded().catch(e => console.error('[stocks] seed failed:', e.message));
  }, 15000);
  setTimeout(async () => {
    const { runEarningsScraper } = require('./scrapers/earningsCalendar');
    console.log('[earnings] Running initial scrape...');
    runEarningsScraper().catch(e => console.error('[earnings] Initial scrape failed:', e.message));
  }, 20000);
  setTimeout(async () => {
    const { scheduleEarningsAiJob } = require('./jobs/earningsAiJob');
    scheduleEarningsAiJob().catch(e => console.error('[earnings ai] Schedule failed:', e.message));
  }, 25000);
}).catch(err => {
  console.error('DB init failed:', err.message);
  app.listen(PORT, () => console.log(`Server running on port ${PORT} (no DB)`));
});

module.exports = app;
