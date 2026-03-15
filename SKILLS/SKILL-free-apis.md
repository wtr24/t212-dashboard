# Free Market Data APIs Skill
## All sources with free tiers, rate limits, and usage patterns

---

## TIER 1 — No API Key Required

### yahoo-finance2 (npm)
- **Limit**: Soft limit ~2000 req/day, no hard enforcement. Use 300ms delay.
- **Data**: Quote, historical OHLCV, earnings trend, financials, analyst data
- **Best for**: Primary data source for everything
```javascript
const yf = require('yahoo-finance2').default;
await yf.quote('AAPL')                    // live price
await yf.historical('AAPL', {period1: '2024-01-01', interval: '1d'})
await yf.quoteSummary('AAPL', {modules: ['earningsTrend','financialData','recommendationTrend']})
await yf.search('AAPL', {newsCount: 10}) // news headlines
```
- **Fields for revenue estimate**: `earningsTrend.trend[0].revenueEstimate.avg.raw`
- **Fields for EPS estimate**: `earningsTrend.trend[0].earningsEstimate.avg.raw`
- **Rate limit pattern**: 300ms between calls, batch max 5 parallel

### NASDAQ Earnings Calendar API (no key)
- **Limit**: ~100 req/day, no auth needed
- **Data**: Earnings calendar by date
```javascript
GET https://api.nasdaq.com/api/calendar/earnings?date=YYYY-MM-DD
Headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
// Response: data.rows[] with {symbol, name, eps_forecast, eps_actual, time, marketCap}
```

### Parqet Stock Logos (no key)
- **Limit**: Unlimited CDN
- **Data**: Stock logos by ticker symbol
```
https://assets.parqet.com/logos/symbol/AAPL?format=svg
https://assets.parqet.com/logos/symbol/AAPL?format=png
```

---

## TIER 2 — Free API Key (sign up required)

### Alpha Vantage
- **Sign up**: alphavantage.co/support/#api-key
- **Free limit**: 25 req/day (premium: 500/day for $50/mo)
- **Env var**: ALPHA_VANTAGE_KEY
- **Data**: Technical indicators (RSI, MACD, SMA, EMA, BBANDS, ATR, STOCH, OBV)
- **Best for**: Confirmed technical indicator values as cross-check
```javascript
// RSI
GET https://www.alphavantage.co/query?function=RSI&symbol=AAPL&interval=daily&time_period=14&series_type=close&apikey=${KEY}
// MACD
GET https://www.alphavantage.co/query?function=MACD&symbol=AAPL&interval=daily&series_type=close&apikey=${KEY}
// SMA
GET https://www.alphavantage.co/query?function=SMA&symbol=AAPL&interval=daily&time_period=50&series_type=close&apikey=${KEY}
// Earnings
GET https://www.alphavantage.co/query?function=EARNINGS&symbol=AAPL&apikey=${KEY}
// Company overview
GET https://www.alphavantage.co/query?function=OVERVIEW&symbol=AAPL&apikey=${KEY}
```
- **Rate limit pattern**: 1 call per 2.5s (25/day = spread over day)
- **Strategy**: Only use AV for portfolio stocks (7 stocks × 3 indicators = 21 calls/day)

### Twelve Data
- **Sign up**: twelvedata.com
- **Free limit**: 800 req/day, 8 req/min
- **Env var**: TWELVE_DATA_KEY
- **Data**: OHLCV, technical indicators, earnings, fundamentals
- **Best for**: Backup price source + technical indicators
```javascript
// Quote
GET https://api.twelvedata.com/quote?symbol=AAPL&apikey=${KEY}
// Time series (OHLCV)
GET https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&outputsize=200&apikey=${KEY}
// RSI
GET https://api.twelvedata.com/rsi?symbol=AAPL&interval=1day&time_period=14&apikey=${KEY}
// MACD
GET https://api.twelvedata.com/macd?symbol=AAPL&interval=1day&apikey=${KEY}
// Earnings
GET https://api.twelvedata.com/earnings?symbol=AAPL&apikey=${KEY}
```
- **Rate limit pattern**: 8 req/min = 1 req per 7.5s

### Financial Modeling Prep (FMP)
- **Sign up**: financialmodelingprep.com
- **Free limit**: 250 req/day (demo key has very limited data)
- **Env var**: FMP_KEY
- **Data**: Earnings calendar, financial statements, analyst targets, SEC filings
- **Best for**: Earnings estimates, revenue data, analyst price targets
```javascript
// Earnings calendar
GET https://financialmodelingprep.com/api/v3/earning_calendar?from=2026-03-10&to=2026-03-17&apikey=${KEY}
// EPS estimates
GET https://financialmodelingprep.com/api/v3/analyst-estimates/AAPL?apikey=${KEY}
// Revenue estimate
GET https://financialmodelingprep.com/api/v3/analyst-estimates/AAPL?period=annual&apikey=${KEY}
// Company profile (market cap, sector etc)
GET https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${KEY}
// Historical earnings
GET https://financialmodelingprep.com/api/v3/historical/earning_calendar/AAPL?limit=8&apikey=${KEY}
```
- **Rate limit pattern**: spread across day, 250/day

### Polygon.io
- **Sign up**: polygon.io
- **Free limit**: 5 req/min, unlimited RPD on free tier (delayed data only)
- **Env var**: POLYGON_KEY
- **Data**: OHLCV, aggregates, news, financials, options flow
- **Best for**: News sentiment, options unusual activity, reliable OHLCV
```javascript
// Aggregate bars (OHLCV)
GET https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/2024-01-01/2026-03-12?apikey=${KEY}
// Previous close
GET https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apikey=${KEY}
// Ticker news
GET https://api.polygon.io/v2/reference/news?ticker=AAPL&limit=10&apikey=${KEY}
// Financials
GET https://api.polygon.io/vX/reference/financials?ticker=AAPL&apikey=${KEY}
// Ticker details (market cap, description)
GET https://api.polygon.io/v3/reference/tickers/AAPL?apikey=${KEY}
```
- **Rate limit pattern**: 12s between calls (5 RPM)

### Open Exchange Rates (for GBP/USD conversion)
- **Sign up**: openexchangerates.org
- **Free limit**: 1000 req/month
- **Env var**: EXCHANGE_RATES_KEY
```javascript
GET https://openexchangerates.org/api/latest.json?app_id=${KEY}&base=USD&symbols=GBP,EUR
```

---

## TIER 3 — Generous Free Tier

### Gemini AI (Google AI Studio)
- **Sign up**: aistudio.google.com
- **Free limit**: gemini-2.5-flash = 20 RPD, 5 RPM. gemini-1.5-flash = 1500 RPD, 15 RPM
- **Env var**: GEMINI_API_KEY, GEMINI_MODEL
- **Note**: Free tier has NO internet access — pass context in prompt
```javascript
POST https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}
Body: { contents: [{parts: [{text: prompt}]}], generationConfig: {temperature: 0.2, maxOutputTokens: 800} }
```

### Groq (ultra-fast inference)
- **Sign up**: console.groq.com
- **Free limit**: 6000 req/day, 30 RPM, llama3-70b
- **Env var**: GROQ_API_KEY
- **Best for**: Fast AI analysis when Gemini quota exhausted
```javascript
POST https://api.groq.com/openai/v1/chat/completions
Headers: { Authorization: 'Bearer ${KEY}' }
Body: { model: 'llama-3.3-70b-versatile', messages: [{role:'user',content:prompt}], temperature: 0.1, max_tokens: 500 }
```

---

## DATA SOURCE PRIORITY MAP

| Data Needed | Primary | Fallback | Last Resort |
|-------------|---------|---------|-------------|
| Live price | yahoo-finance2 | Twelve Data | Alpha Vantage |
| OHLCV history | yahoo-finance2 | Polygon | Twelve Data |
| RSI/MACD calc | Compute from OHLCV | Alpha Vantage | Twelve Data |
| Revenue estimate | yahoo-finance2 earningsTrend | FMP | NASDAQ API |
| EPS estimate | yahoo-finance2 earningsTrend | FMP | NASDAQ API |
| Analyst targets | yahoo-finance2 financialData | FMP | Alpha Vantage |
| Earnings calendar | NASDAQ API | FMP | yahoo-finance2 |
| Company info | yahoo-finance2 | FMP profile | Polygon ticker |
| Stock news | Polygon news | yahoo-finance2 search | RSS feeds |
| Stock logo | Parqet CDN | Clearbit | Initials fallback |
| AI analysis | Gemini 2.5 Flash | Gemini 1.5 Flash | Groq |
| GBP/USD rate | openexchangerates | hardcode 0.79 | |

---

## RATE LIMIT MANAGER PATTERN
```javascript
// server/services/rateLimitManager.js
const limits = {
  alphavantage: { perDay: 25, perMin: null, used: 0, resetDate: null },
  twelvedata:   { perDay: 800, perMin: 8, used: 0, resetDate: null },
  fmp:          { perDay: 250, perMin: null, used: 0, resetDate: null },
  polygon:      { perDay: null, perMin: 5, used: 0, resetDate: null },
  gemini25:     { perDay: 20, perMin: 5, used: 0, resetDate: null },
  gemini15:     { perDay: 1500, perMin: 15, used: 0, resetDate: null },
};

// Track in DB table: api_usage { api_name, date, requests_today }
// Before each call: check remaining, delay if needed, record after call
// Morning reset: clear counts where date < today
```

---

## GETTING API KEYS — STEP BY STEP

### Alpha Vantage (2 min)
1. Go to: https://www.alphavantage.co/support/#api-key
2. Enter email → Get free key instantly
3. Add to NAS .env: `ALPHA_VANTAGE_KEY=your_key`

### Twelve Data (3 min)
1. Go to: https://twelvedata.com/register
2. Verify email → Dashboard → API Keys
3. Add to NAS .env: `TWELVE_DATA_KEY=your_key`

### FMP (3 min)
1. Go to: https://financialmodelingprep.com/register
2. Verify email → Dashboard → API Keys
3. Add to NAS .env: `FMP_KEY=your_key`

### Polygon (3 min)
1. Go to: https://polygon.io/dashboard/signup
2. Verify email → Dashboard → API Keys
3. Add to NAS .env: `POLYGON_KEY=your_key`

### Groq (2 min)
1. Go to: https://console.groq.com
2. Sign in with Google → API Keys → Create key
3. Add to NAS .env: `GROQ_API_KEY=your_key`
