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
}).catch(err => {
  console.error('DB init failed:', err.message);
  app.listen(PORT, () => console.log(`Server running on port ${PORT} (no DB)`));
});

module.exports = app;
