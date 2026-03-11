# Token Optimizer Skill
## Purpose: Maximize output quality per token spent in Claude Code sessions

## PRE-FLIGHT CHECKLIST (run before ANY task, costs ~200 tokens)
1. `git log --oneline -5` — what was last done
2. `git diff HEAD --name-only` — what files changed
3. `docker compose ps` — what is running
4. `grep -r 'TODO\|FIXME' src/ --include='*.js' --include='*.jsx' -l` — what is broken

Never skip this — costs 200 tokens, saves 2000 tokens of wrong assumptions.

---

## CONTEXT WINDOW BUDGET RULES

### The 80% Rule
When reaching 80% context window, IMMEDIATELY write this checkpoint:

```
=== CHECKPOINT ===
DONE: [3 bullets of completed work]
IN PROGRESS: [1 bullet of current task]
NEXT: [1 bullet of what to do next]
FILES CHANGED: [comma separated list]
==================
```
Then: clear context, paste checkpoint, continue.
Never try to finish — checkpoint and continue beats losing work.

### Token Cost Reference
| Action | Cost |
|--------|------|
| Read 100 line file | ~150 tokens |
| Write 100 line file | ~150 tokens |
| Full file rewrite (500 lines) | ~750 tokens |
| Diff edit (5 lines changed) | ~50 tokens |
| Shell command | ~20 tokens |
| Clarifying question | ~50 tokens |

ALWAYS prefer: diff edit > targeted read > full rewrite

### The Read Budget
- Aim for <10 file reads per session
- Before reading: is this file definitely needed?
- Read priority: config > routes > services > components
- Never read: node_modules, lock files, migration files, test fixtures

### The Write Budget
Before writing ANY code:
1. Does this file already exist? (read first if yes)
2. Can I achieve this with <20 line diff? (prefer over full rewrite)
3. Is this file shared? (if yes, be surgical)

---

## AGENT SIZING GUIDE

| Task | Agents | Token Cost |
|------|--------|------------|
| Fix 1 bug in 1 file | 1 | ~300 |
| Add 1 API endpoint | 2 | ~600 |
| Add 1 page (backend+frontend) | 4 | ~1200 |
| New feature (all layers) | 6-8 | ~2400 |
| Full module rebuild | 8-12 | ~4000 |
| Full app overhaul | 12-16 | ~6000 |

Over-agenting small tasks wastes tokens on orchestration overhead.
Under-agenting large tasks forces sequential work and context resets.

## PARALLEL AGENT RULES

SAFE to parallelize:
- Backend route + Frontend page (different files)
- Multiple scrapers (different files)
- Multiple DB tables (different migrations)

UNSAFE to parallelize:
- Two agents editing same file
- Agent B needs Agent A output
- Both agents need to read same large file

---

## PROMPT COMPRESSION TECHNIQUES

Instead of: `'Please could you look at the file and find where the bug is and fix it'`
Write: `'Read server/services/t212.js line 45-80, fix field mapping bug, diff edit only'`
Savings: ~50 tokens per prompt

Instead of: `'Make sure to handle errors and add loading states and empty states'`
Write: `'Add: try/catch->log, loading skeleton, empty state card'`
Savings: ~30 tokens

Instead of repeating context each message, write CLAUDE.md once and reference it:
`'Per CLAUDE.md architecture: fix X in Infrastructure layer'`

---

## RECOVERY PROTOCOL (when tokens running low)

When <20% context remaining:
1. Stop all work immediately
2. Run: `git status && git diff --stat`
3. Write recovery note: what works, what is broken, exact next step
4. Commit working state: `git add . && git commit -m 'wip: [state]'`
5. Start new session with: `'Read CLAUDE.md. Last session: [recovery note]. Continue.'`

Starting fresh with good context beats running out mid-task.

---

## ANTI-PATTERNS (token waste)

- Asking Claude to explain what it is about to do: -100 tokens
- Printing entire file contents when only 10 lines needed: -500 tokens
- Rewriting working code to add 1 feature: -400 tokens
- Running same test 3 times: -60 tokens
- Adding comments to every line: -200 tokens
- Asking for confirmation before obvious steps: -100 tokens per confirmation
- Describing bugs without reading the actual file: -300 tokens

## BEST PATTERNS (token efficiency)

- Surgical diff edits with exact line context: save 400 tokens
- Read only the function you need, not whole file: save 300 tokens
- Run build check BEFORE pushing: save 500 tokens
- Cache file contents in agent memory, don't re-read: save 200 tokens
- Use Grep to find relevant lines before full Read: save 250 tokens
- Batch related changes in one agent: save 200 tokens
- Read multiple files in one parallel tool call: save 300 tokens

---

## SESSION STARTUP TEMPLATE (optimal token use)

First message of every session:
```
Read CLAUDE.md (first 50 lines only).
Run: git log --oneline -3 && git diff HEAD --name-only && docker compose ps
Summarise: last commit, changed files, container health.
Then: [actual task]
```
Cost: ~400 tokens. Saves: ~2000 tokens of wrong assumptions.

---

## CONTEXT PRESERVATION BETWEEN SESSIONS

At end of each session update memory:
- What was completed this session (3 bullets)
- What is currently broken (if anything)
- Exact next step to take
- Any gotchas discovered

---

## T212 DASHBOARD SPECIFIC SHORTCUTS

### Field name gotchas (save re-reading files)
- T212 orders: `filledQuantity` not `quantity`, `limitPrice` not `price`, `type: "LIMIT_BUY"` not `"BUY"`
- T212 account: `investments.unrealizedProfitLoss`, `cash.availableToTrade`
- Positions: `ppl` not `pnl`, `averagePrice` not `avgCost`
- cleanTicker: strips `_US_EQ`, `_EQ`, `_LSE` etc - done in t212.js `getPortfolio()`
- calcMetrics returns: `unrealizedPnl`, `availableCash`, `totalCost`, `returnPct`
  NOT: `totalPnl`, `cash.free`, `cash.invested`, `cash.result`

### Cache key patterns
- `t212:portfolio` (30s), `t212:summary` (30s), `t212:orders` (300s)
- `ai:v2:TICKER` (3600s), `stock:yahoo:quote:TICKER` (60s)
- `earnings:today` (300s), `earnings:week` (300s)

### File locations (save globbing)
- API client: `server/services/t212.js`
- DB schema: `server/models/db.js`
- Cron jobs: `server/jobs/refresh.js`
- App startup: `server/app.js`
- Routes: `server/routes/*.js`
- Scrapers: `server/scrapers/*.js`
- React pages: `client/src/pages/*.js`
- Hooks: `client/src/hooks/useApi.js`

### NASDAQ Earnings API (free, no key)
- URL: `https://api.nasdaq.com/api/calendar/earnings?date=YYYY-MM-DD`
- Headers: `User-Agent: Mozilla/5.0`, `Accept: application/json`, `Referer: https://www.nasdaq.com/`
- Returns: rows with symbol, name, epsForecast, noOfEsts, time, fiscalQuarterEnding, lastYearEPS
- time values: "time-not-supplied", "pre-market", "after-hours"
