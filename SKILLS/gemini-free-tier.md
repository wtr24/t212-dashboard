# Gemini Free Tier API — T212 Dashboard Patterns

## Confirmed Working Model (as of March 2026)

**Only model available on this API key:** `gemini-2.5-flash`

Tested via ListModels — all others (1.5-flash, 2.0-flash-exp, 2.0-flash, gemini-pro) return 404.

```
GET https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY
→ Returns: models/gemini-2.5-flash (version 001)
```

## Rate Limits (Free Tier, AI Studio Key)

| Limit      | Value       | Notes                              |
|------------|-------------|------------------------------------|
| RPD        | 20/day      | Hard limit, resets midnight UTC    |
| RPM        | 5/min       | 1 request per 12s minimum          |
| Safe delay | 15s between calls | Gives headroom                |
| Token limit| 250K TPM    | Plenty for compact prompts         |

**Critical:** With 88+ earnings and only 20 RPD, you must prioritise:
1. Portfolio stocks first
2. Then by market cap / analyst coverage
3. Never do more than quota allows — check DB before each call

## Thinking Model Response Format

Gemini 2.5 Flash is a "thinking" model. The response `parts[]` array contains:
- `parts[0]`: may be the reasoning/thought (has `thought: true`, no `text`)
- `parts[1]` (or later): the actual text response

**Wrong:**
```js
const text = parsed.candidates[0].content.parts[0].text; // EMPTY on thinking models
```

**Correct:**
```js
const parts = parsed.candidates?.[0]?.content?.parts || [];
const text = parts.find(p => p.text && !p.thought)?.text
  || parts.filter(p => p.text).map(p => p.text).join('').trim();
```

## Quota Tracking Pattern (DB-persisted, survives restarts)

```sql
CREATE TABLE IF NOT EXISTS gemini_usage (
  id SERIAL PRIMARY KEY,
  model VARCHAR(50) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  requests_today INT DEFAULT 0,
  tokens_used INT DEFAULT 0,
  last_request_at TIMESTAMP,
  UNIQUE(model, date)
);
```

```js
// Check before calling
async function getRemainingQuota() {
  const r = await query(
    'SELECT requests_today FROM gemini_usage WHERE model=$1 AND date=CURRENT_DATE',
    [GEMINI_MODEL]
  );
  return Math.max(0, FREE_RPD - (r.rows[0]?.requests_today || 0));
}

// Record after success
async function recordUsage() {
  await query(
    `INSERT INTO gemini_usage (model, date, requests_today, last_request_at)
     VALUES ($1, CURRENT_DATE, 1, NOW())
     ON CONFLICT (model, date) DO UPDATE
     SET requests_today = gemini_usage.requests_today + 1, last_request_at = NOW()`,
    [GEMINI_MODEL]
  );
}
```

## Native HTTPS Module (not axios)

Axios sometimes has proxy/DNS issues on Synology NAS Docker. Use native `https`:

```js
function callGeminiOnce(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject(Object.assign(new Error('Gemini 429'), { code: 429 }));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Gemini ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const parts = parsed.candidates?.[0]?.content?.parts || [];
          const text = parts.find(p => p.text && !p.thought)?.text
            || parts.filter(p => p.text).map(p => p.text).join('').trim();
          resolve(text);
        } catch (e) { reject(new Error(`Parse failed: ${data.slice(0, 80)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Gemini timeout')); });
    req.write(body);
    req.end();
  });
}
```

## Compact Prompt Template (~250-300 tokens)

Compact prompts preserve quota (250K TPM limit). Don't send 800-token verbose prompts.

```js
const prompt = `Equity analyst. Predict earnings beat/miss for:
${ticker} (${company}) | ${fiscalQuarter} | ${reportDate} ${reportTime}
EPS est: ${epsEstimate || 'N/A'} | Historical beat rate: ${beatRateLast4}/4

Recent headlines (Yahoo Finance):
${headlines.slice(0, 5).map((h, i) => `${i+1}. ${h}`).join('\n')}

JSON only, no markdown:
{"signal":"BUY|SELL|HOLD","confidence":0-100,"beatProbability":0-100,"sentiment":"POSITIVE|NEGATIVE|MIXED|NEUTRAL","newsSentiment":"POSITIVE|NEGATIVE|NEUTRAL","analystTrend":"UPGRADING|DOWNGRADING|STABLE","summary":"2 sentences.","keyFactors":["f1","f2","f3"],"risks":["r1","r2"]}`;
```

## Wave Scheduling (20 RPD, 88 earnings)

```
Wave 1 - 06:30 UTC: Portfolio stocks (≤7 requests, highest priority)
Wave 2 - 07:00 UTC: Top pre-market by priority score (≤8 requests)
Wave 3 - 12:00 UTC: Remaining quota for AMC earnings (≤5 requests)
Manual run: Shows "X of 20 remaining" before running
```

**Priority scoring:**
```js
let score = 0;
if (portfolioTickers.has(ticker)) score += 100;
if (reportTime === 'BMO') score += 10;
if (eps_estimate != null) score += 15;
if (analyst_count >= 5) score += 10;
if (analyst_count >= 15) score += 10;
```

## Free Tier Gotchas

1. **No Gemini internet access** — Gemini free tier cannot browse web. Pre-fetch news from Yahoo Finance, pass headlines as text in prompt.

2. **JSON in markdown** — Model sometimes wraps JSON in ```json blocks. Strip before parsing:
   ```js
   const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
   ```

3. **429 = mark exhausted** — Don't retry 429 blindly. Record quota as exhausted in DB, move on. Next day's waves will work.

4. **Empty text from thinking** — `parts[0]` is thinking content with no `.text`. Always `find(p => p.text && !p.thought)`.

5. **Diagnose with ListModels first** — Before assuming a model name, always confirm:
   ```
   GET /v1beta/models?key=KEY
   ```

## Env Vars

| Var | Default | Purpose |
|-----|---------|---------|
| `GEMINI_API_KEY` | required | Google AI Studio key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Override model |
| `GEMINI_RPD` | `20` | Daily quota override for paid tier |
| `GEMINI_DELAY_MS` | `15000` | Delay between calls (ms) |
