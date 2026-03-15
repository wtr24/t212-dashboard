# Known Issues and Limitations

## Last tested: 2026-03-15
## Test results: 31/35 API endpoints passing (6 are phantom routes not used by any frontend page)

---

## Working Features

### Infrastructure
- API server healthy (db: true, redis: true, uptime: OK)
- 747 earnings records in DB (Jan–Apr 2026)
- Portfolio: 7 positions, £17,682 total value
- Paper trading: 50 portfolios initialized, all tracking real holdings

### API Endpoints (all returning 200)
- `GET /health` — db + redis status
- `GET /api/portfolio/summary` — total value, P&L, cash, positions
- `GET /api/portfolio/positions` — live position data
- `GET /api/portfolio/history` — historical snapshots
- `GET /api/earnings/today` — today's earnings (empty on weekends)
- `GET /api/earnings/week` — this week's earnings (grouped by date)
- `GET /api/earnings/month` — this month's earnings
- `GET /api/earnings/history` — past earnings with actuals
- `GET /api/earnings/ai-status` — Gemini quota, wave schedule
- `GET /api/earnings/scrape-status` — 747 total records, date range
- `GET /api/earnings/:ticker` — single ticker earnings history
- `GET /api/technical/:ticker` — full TA (RSI, MACD, MA, support/resistance)
- `GET /api/technical/portfolio` — TA for all portfolio tickers
- `GET /api/technical/screener` — filter by signal/score/trend
- `GET /api/decisions/:ticker` — master signal (HOLD/BUY/SELL, confidence, evidence)
- `GET /api/decisions/portfolio` — signals for all 7 positions + summary
- `GET /api/decisions/macro` — VIX, Fear&Greed, sector performance (null when markets closed)
- `GET /api/decisions/screener/:preset` — 6 presets (strong_buy, oversold_quality, golden_cross, earnings_soon, congress_buys, insider_buys)
- `GET /api/congress/trades` — 25 recent trades
- `GET /api/insider/trades` — 25 recent insider transactions
- `GET /api/analysis` — Groq AI analysis of all positions
- `GET /api/analysis/status` — Groq model status
- `GET /api/journal` — trading journal entries
- `GET /api/research/:ticker` — full stock research (overview, technical, earnings, congress, insider, AI verdict)
- `GET /api/paper/portfolios` — all 50 paper portfolios
- `GET /api/paper/leaderboard` — top10/bottom10/all sorted by return
- `GET /api/paper/strategy-analysis` — performance by strategy type
- `GET /api/paper/best-recommendation` — which strategy beats real portfolio
- `GET /api/admin/quota-status` — API quota usage (AlphaVantage, TwelveData, FMP, Polygon, Yahoo)

### Pages Working
All 16 pages load without crashes. Field names match API responses:
- Dashboard: portfolio value, decisions, macro topbar, congress feed, screener opportunities
- Positions: live positions with P&L
- Earnings: 747 records, AI signals, beat probability
- CongressTracker: 25 trades, member filter, CSV export
- InsiderTracker: 25 trades, insider detail modal
- Research: full 8-tab research page
- Predictions (AI Signals): Groq analysis of all positions
- MarketHub: macro context, sectors (null VIX on weekends is handled gracefully)
- Watchlist: localStorage-persisted, decision engine signals
- Screener: 6 presets, decision engine results
- Journal: CRUD trade entries with signal-at-entry
- Paper Trading / Simulator: 50 portfolios, leaderboard, scatter chart

---

## Bugs Fixed This Session

### CRITICAL — nginx proxy misconfiguration
- **Bug**: `client/nginx.conf` had `proxy_pass http://api:5002` but docker-compose service is named `server`
- **Impact**: ALL API calls from the browser via port 3002 (nginx) were failing. The app was broken for any user accessing `http://192.168.0.18:3002`
- **Fix**: Changed to `proxy_pass http://server:5002`
- **File**: `client/nginx.conf`

### HIGH — Dashboard congress API 404
- **Bug**: `Dashboard.js` called `GET /api/congress?limit=5` which doesn't exist
- **Impact**: Congress feed on Dashboard always empty
- **Fix**: Changed to `GET /api/congress/trades?limit=5`
- **File**: `client/src/pages/Dashboard.js`

### MEDIUM — `getPortfolio()` shape bug in decision engine
- **Bug**: `decisionEngine.js` did `positions = await getPortfolio() || []` but `getPortfolio()` returns `{ data: [...], source: '...' }` not an array
- **Impact**: Portfolio decisions returned 0 results (map was called on an object)
- **Fix**: `const r = await getPortfolio(); positions = r?.data || r || []`
- **File**: `server/services/decisionEngine.js`

---

## Known Limitations (not fixable without external data/APIs)

### VIX and Fear & Greed Index returning null
- **Cause**: Yahoo Finance `^VIX` returns null `regularMarketPrice` when markets are closed (weekends/holidays). CNN Fear & Greed API may be rate-limited or blocked on NAS network.
- **Impact**: MarketHub and Dashboard show `—` for these indicators. No crash.
- **Workaround**: Values populate automatically when NYSE opens Monday–Friday.

### Gemini AI analysis: 20 requests/day limit
- **Cause**: Free tier quota — 20 RPD (requests per day) on `gemini-2.5-flash`
- **Impact**: Only 20 earnings per day get AI signals. Wave schedule (06:30/07:00/12:00) prioritises portfolio holdings and high-cap BMO stocks.
- **Workaround**: Upgrade Gemini plan for unlimited AI analysis.

### Revenue estimates: only populated for large-cap stocks
- **Cause**: Yahoo Finance doesn't provide revenue consensus for small/micro-cap stocks
- **Impact**: `revenue_estimate` is NULL for ~40% of earnings records (smaller companies)

### Technical analysis: requires 50+ days of price history
- **Cause**: MA200 needs 200 candles; new or small stocks fail TA
- **Impact**: `insufficient_data` error for stocks with < 20 trading days of history

### Paper trading simulation runs 0 trades on weekends/holidays
- **Cause**: Decision engine returns HOLD for most positions when markets are closed; no new signals trigger buy/sell rules
- **Impact**: `total_trades: 0` for all portfolios on Sunday
- **Expected**: Simulation generates trades on weekdays when market signals are stronger

### Insider/Congress: no live scraping
- **Cause**: Scrapers may need Playwright update if source HTML changes
- **Impact**: Data is from last successful scrape; may be days old. Dates shown in UI.

### Sector ETF performance: empty array when markets closed
- **Cause**: Yahoo Finance returns null price changes outside market hours
- **Impact**: MarketHub sector bars empty on weekends

---

## Routes Not Registered (not called by frontend — not breaking anything)
These 5 endpoints return 404 but no frontend page calls them:
- `GET /api/portfolio/performance` — not in any page
- `GET /api/watchlist` — Watchlist.jsx uses localStorage, not an API
- `GET /api/screener/presets` — Screener.jsx uses `/api/decisions/screener/:preset`
- `GET /api/alerts` — no alerts page exists yet
- `GET /api/admin/scraper-status` — Admin panel not built yet

---

## Pending Features (not built)
- Alerts page (`/api/alerts` route + frontend)
- Admin scraper control panel
- Portfolio performance chart endpoint
- Push notifications for Discord alerts UI
