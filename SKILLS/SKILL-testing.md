# Comprehensive System Testing — T212 Dashboard
## Strict phase order: DIAGNOSE → REPORT → FIX → RE-TEST → DOCUMENT

---

## PHILOSOPHY
Test the FULL chain: DB → Service → API Route → Frontend field mapping.
A green API response means nothing if the frontend reads the wrong field name.
Phases 1-5 are READ ONLY. Zero code changes until Phase 6 failure report is complete.

---

## PHASE 1 — INFRASTRUCTURE (read only)

```bash
echo '======= NAS API HEALTH ======='
curl -s http://192.168.0.18:5002/health

echo '======= CONTAINERS ======='
# On NAS via SSH:
docker compose ps

echo '======= MEMORY ======='
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'

echo '======= API ERRORS LAST 100 LINES ======='
docker logs t212-dashboard-api-1 --tail 100 2>&1 | grep -iE 'error|fail|unhandled|exception|crash|ECONNREFUSED' | tail -30

echo '======= DB TABLES ======='
docker exec t212-dashboard-postgres-1 psql -U t212 -d t212 -c "\dt"

echo '======= TABLE ROW COUNTS ======='
docker exec t212-dashboard-postgres-1 psql -U t212 -d t212 -c "
SELECT relname as table_name, n_live_tup as row_count
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

echo '======= REDIS ======='
docker exec t212-dashboard-redis-1 redis-cli ping
docker exec t212-dashboard-redis-1 redis-cli dbsize

echo '======= ENV VARS SET ======='
docker exec t212-dashboard-api-1 printenv | grep -E 'KEY|TOKEN|URL|WEBHOOK|MODEL' | sed 's/=.*/=SET/' | sort
```

---

## PHASE 2 — API ENDPOINT MATRIX

```bash
BASE=http://192.168.0.18:5002

test_ep() {
  local name="$1" url="$2" field="$3"
  local code=$(curl -s -o /tmp/resp.json -w '%{http_code}' "$BASE$url" -m 10)
  local has='N/A'
  [ -n "$field" ] && grep -q "$field" /tmp/resp.json 2>/dev/null && has='YES' || { [ -n "$field" ] && has='MISSING'; }
  local sz=$(wc -c < /tmp/resp.json 2>/dev/null || echo 0)
  echo "$code | ${sz}b | field=$has | $name"
}

# CORE
test_ep 'Health'               '/health'                      'ok\|status'
test_ep 'Portfolio Summary'    '/api/portfolio/summary'       'totalValue\|total_value'
test_ep 'Portfolio Positions'  '/api/portfolio/positions'     'ticker'
test_ep 'Portfolio History'    '/api/portfolio/history'       'date\|snapshot'
test_ep 'Portfolio Performance' '/api/portfolio/performance'  'return\|pnl'

# EARNINGS
test_ep 'Earnings Today'       '/api/earnings/today'          'ticker'
test_ep 'Earnings Week'        '/api/earnings/week'           'ticker'
test_ep 'Earnings Month'       '/api/earnings/month'          'ticker'
test_ep 'Earnings History'     '/api/earnings/history'        'ticker'
test_ep 'Earnings AI Status'   '/api/earnings/ai-status'      'lastRun\|last_run'
test_ep 'Earnings Single'      '/api/earnings/NVDA'           'ticker'

# TECHNICAL
test_ep 'Technical NVDA'       '/api/technical/NVDA'          'rsi\|technical_grade'
test_ep 'Technical Portfolio'  '/api/technical/portfolio'     'ticker'
test_ep 'Technical Screener'   '/api/technical/screener'      '.'

# DECISIONS
test_ep 'Decisions NVDA'       '/api/decisions/NVDA'          'signal\|confidence'
test_ep 'Decisions Portfolio'  '/api/decisions/portfolio'     'decisions\|summary'
test_ep 'Macro Dashboard'      '/api/decisions/macro'         'vix\|fearGreed'

# MARKET DATA
test_ep 'Congress Trades'      '/api/congress/trades'         'ticker\|member'
test_ep 'Insider Trades'       '/api/insider/trades'          'ticker\|insider'

# TOOLS
test_ep 'Watchlist'            '/api/watchlist'               '.'
test_ep 'Screener Presets'     '/api/screener/presets'        'name\|preset'
test_ep 'Journal'              '/api/journal'                 '.'
test_ep 'Alerts'               '/api/alerts'                  '.'
test_ep 'Research AAPL'        '/api/research/AAPL'           'ticker'

# PAPER TRADING
test_ep 'Paper Portfolios'     '/api/paper/portfolios'        '.'
test_ep 'Paper Leaderboard'    '/api/paper/leaderboard'       '.'

# ADMIN
test_ep 'Quota Status'         '/api/admin/quota-status'      'yahoofinance\|gemini'
```

---

## PHASE 3 — DATA QUALITY AUDIT

```bash
# Direct psql (on NAS):
docker exec t212-dashboard-postgres-1 psql -U t212 -d t212 -c "
SELECT
  COUNT(*) as total,
  ROUND(COUNT(eps_estimate)::numeric/NULLIF(COUNT(*),0)*100) as eps_pct,
  ROUND(COUNT(revenue_estimate)::numeric/NULLIF(COUNT(*),0)*100) as revenue_pct,
  ROUND(COUNT(market_cap)::numeric/NULLIF(COUNT(*),0)*100) as mktcap_pct,
  ROUND(COUNT(ai_signal)::numeric/NULLIF(COUNT(*),0)*100) as ai_signal_pct
FROM earnings_calendar;"

# Via API response inspection:
curl -s http://192.168.0.18:5002/api/earnings/today | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const items=Array.isArray(d)?d:d.data||[];
if(!items.length){console.log('EMPTY');process.exit();}
const e=items[0];
const fields=['ticker','company','eps_estimate','revenue_estimate','market_cap','analyst_count','ai_signal','ai_summary','ai_beat_probability'];
fields.forEach(f=>console.log(e[f]!=null?'PRESENT':'MISSING',f,'=',String(e[f]||'').slice(0,40)));
const snake=Object.keys(e).filter(k=>k.includes('_'));
const camel=Object.keys(e).filter(k=>/[A-Z]/.test(k.slice(1)));
console.log('snake_case:',snake.join(','));
console.log('camelCase:',camel.join(','));
if(snake.length&&camel.length)console.log('WARNING: MIXED - frontend bug risk');
"
```

---

## PHASE 4 — FRONTEND AUDIT

```bash
# Pages that exist
ls client/src/pages/

# Routes registered
grep -E 'path=|Route' client/src/App.js | head -30

# Field references per page
for f in client/src/pages/*.jsx; do
  echo "--- $(basename $f .jsx) ---"
  grep -oE '\b(e|item|row|earning|pos|p)\.([\w_]+)' "$f" 2>/dev/null | \
    grep -vE '\.(map|filter|length|push|find|then|catch|toString|toFixed|join|includes|replace|toLowerCase|keys|values)' | \
    sed 's/.*\.//' | sort -u | tr '\n' ' '
  echo
done

# API base URL used
grep -rn 'localhost\|192\.168\|baseURL\|5002' client/src/ --include='*.js' --include='*.jsx' | grep -v node_modules | head -10
```

---

## PHASE 5 — SERVICE HEALTH (docker exec on NAS)

```bash
docker exec t212-dashboard-api-1 node -e "
async function test(name, fn) {
  try { const r = await fn(); console.log('PASS:', name, '|', String(r).slice(0,80)); }
  catch(e) { console.log(e.message.includes('Cannot find module') ? 'MISSING' : 'FAIL', name, '|', e.message.slice(0,80)); }
}
async function run() {
  await test('yahoo-finance2', async () => { const yf=require('yahoo-finance2').default; const r=await yf.quote('AAPL'); return 'price='+r.regularMarketPrice; });
  await test('technicalAnalysis', async () => { const ta=require('./server/services/technicalAnalysis'); return typeof ta.analyseStock==='function'?'OK':'WRONG EXPORT'; });
  await test('decisionEngine', async () => { const de=require('./server/services/decisionEngine'); return typeof de.generateMasterSignal==='function'?'OK':'WRONG EXPORT'; });
  await test('paperTrading', async () => { const p=require('./server/services/paperTrading'); return typeof p.runDailySimulation==='function'?'OK':'WRONG EXPORT'; });
  await test('rateLimitManager', async () => { const r=require('./server/services/rateLimitManager'); const s=await r.getQuotaStatus(); return 'apis='+Object.keys(s).length; });
  await test('db connection', async () => { const db=require('./server/models/db'); const r=await db.query('SELECT COUNT(*) FROM earnings_calendar'); return 'rows='+r.rows[0].count; });
}
run().catch(e=>console.log('RUNNER ERROR:', e.message));
"
```

---

## PHASE 6 — FAILURE REPORT FORMAT

```
=== FAILURE REPORT ===

CRITICAL (app broken):
1. [desc] | ROOT CAUSE: [why] | FIX: [what]

HIGH (major feature broken):
2. [desc] | ROOT CAUSE: [why] | FIX: [what]

MEDIUM (data quality):
3. [desc] | ROOT CAUSE: [why] | FIX: [what]

LOW (minor):
4. [desc] | ROOT CAUSE: [why] | FIX: [what]

KNOWN LIMITATIONS:
- [desc]

=== END REPORT ===
```

Root cause rules:
- 404 = route not registered in index.js OR route file missing
- Empty response = DB empty OR scraper never ran OR wrong query
- NULL fields = enrichment never ran OR yahoo returned null
- Frontend shows — = field name mismatch (snake vs camel)
- Service MISSING = file not created OR wrong export name

---

## PHASE 7 — FIX PATTERNS

### Missing routes
```bash
# Check registered
grep "app.use" server/app.js
# Add missing: app.use('/api/ROUTE', require('./routes/ROUTE'));
```

### Field mapping normalizer (add to any route returning earnings/positions)
```js
const toFrontend = (row) => ({
  ...row,
  revenueEstimate: row.revenue_estimate,
  revenueActual: row.revenue_actual,
  marketCap: row.market_cap,
  analystCount: row.analyst_count,
  epsEstimate: row.eps_estimate,
  epsActual: row.eps_actual,
  epsSurprise: row.eps_surprise,
  aiSignal: row.ai_signal,
  aiConfidence: row.ai_confidence,
  aiBeatProbability: row.ai_beat_probability,
  aiSummary: row.ai_summary,
  reportTime: row.report_time,
  reportDate: row.report_date,
});
```

### Trigger enrichment manually
```bash
# On NAS:
docker exec t212-dashboard-api-1 node -e "
const mdf = require('./server/services/marketDataFetcher');
const db = require('./server/models/db');
db.query('SELECT ticker FROM earnings_calendar WHERE report_date>=CURRENT_DATE-1 AND revenue_estimate IS NULL LIMIT 25')
  .then(r => mdf.batchEnrichEarnings(r.rows.map(x=>x.ticker)))
  .then(r => console.log('ENRICHED:', r))
  .catch(e => console.log('FAIL:', e.message));
"
```

### Paper portfolio init
```bash
docker exec t212-dashboard-api-1 node -e "
const pt = require('./server/services/paperTrading');
pt.initPaperPortfolios()
  .then(() => { console.log('INIT OK'); return pt.runDailySimulation(); })
  .then(r => console.log('SIM OK'))
  .catch(e => console.log('FAIL:', e.message));
"
```

---

## PHASE 8 — RE-TEST SUITE

```bash
BASE=http://192.168.0.18:5002
PASS=0; FAIL=0; TOTAL=0

check() {
  local name="$1" cmd="$2" expect="$3"
  TOTAL=$((TOTAL+1))
  result=$(eval "$cmd" 2>/dev/null)
  if echo "$result" | grep -qiE "$expect"; then
    echo "✓ $name"; PASS=$((PASS+1))
  else
    echo "✗ $name | got: ${result:0:60}"; FAIL=$((FAIL+1))
  fi
}

check 'API running'    "curl -s -o /dev/null -w '%{http_code}' $BASE/health" '200'
check 'DB connected'   "curl -s $BASE/health" '"db":true'
check 'Redis up'       "curl -s $BASE/health" '"redis":true'

for ep in portfolio/summary earnings/today earnings/week technical/NVDA decisions/NVDA admin/quota-status watchlist journal paper/portfolios paper/leaderboard congress/trades insider/trades; do
  check "API $ep" "curl -s -o /dev/null -w '%{http_code}' $BASE/api/$ep -m 10" '200'
done

check 'Earnings has revenue field' "curl -s $BASE/api/earnings/today" 'revenue'
check 'Decisions has signal'       "curl -s $BASE/api/decisions/NVDA" 'signal'
check 'Decisions has evidence'     "curl -s $BASE/api/decisions/NVDA" 'evidence\|bullEvidence'

echo ""
echo "=== FINAL: $PASS/$TOTAL passed, $FAIL failed ==="
[ $FAIL -eq 0 ] && echo "ALL SYSTEMS GO" || echo "FIX FAILURES BEFORE DEPLOY"
```

---

## COMMON BUGS

| Bug | Detect | Fix |
|-----|--------|-----|
| snake_case vs camelCase | Compare API fields vs frontend grep | Add `toFrontend()` mapper |
| Empty array vs null | `curl api \| node -e "print type"` | Add `\|\| []` defaults |
| DB column missing | `psql \d tablename` | ALTER TABLE migration |
| Redis cache stale | `redis-cli del KEY` | Clear specific key |
| 404 on route | Check `grep 'app.use' server/app.js` | Register in app.js |
| Service wrong export | `node -e "require('./service')"` | Fix module.exports |
| Paper portfolios empty | Check paper_portfolios count | POST /api/paper/init |
