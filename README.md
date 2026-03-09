# T212 Dashboard

Bloomberg Terminal meets Apple Vision Pro — full Trading 212 portfolio analytics.

## Stack
- React + Framer Motion + Recharts (frontend, port 3002)
- Node/Express (backend, port 5002)
- PostgreSQL 16
- Redis 7

## Quick Start (Local Dev)

```bash
# 1. Copy env
cp server/.env.example server/.env
# Edit server/.env with your API keys

# 2. Start services
docker compose up postgres redis -d

# 3. Backend
cd server && npm install && npm start

# 4. Frontend
cd client && npm install && npm start
```

## API Keys Required

| Key | Where to get | Free tier |
|-----|-------------|-----------|
| T212_API_KEY | Trading212 app → Settings → API | Yes |
| GROQ_API_KEY | console.groq.com | Yes (generous) |
| ALPHA_VANTAGE_KEY | alphavantage.co | Yes (25 req/day) |

**T212 API Key location:** Trading 212 app → hamburger menu → Settings → API (scroll to bottom)

## NAS Deploy (Synology/QNAP)

```bash
# One command — pulls pre-built images, starts on port 3002
cd nas-deploy
cp .env.example .env && nano .env   # add your API keys
bash setup.sh
```

Dashboard: `http://your-nas-ip:3002`

## GitHub Actions

Push to `main` → auto-builds + pushes to Docker Hub.

**Required secrets:** `DOCKER_USERNAME`, `DOCKER_PASSWORD`

## Docker Images
- `wtr24dev/t212-api:latest` — backend
- `wtr24dev/t212-client:latest` — frontend

## T212 Endpoints Integrated

- `GET /api/v0/equity/portfolio` — all positions
- `GET /api/v0/equity/account/cash` — cash balances
- `GET /api/v0/equity/account/info` — account info + ISA
- `GET /api/v0/history/orders?limit=50` — order history
- `GET /api/v0/history/dividends?limit=50` — dividend history
- `GET /api/v0/history/transactions?limit=50` — deposits/withdrawals
- `GET /api/v0/equity/pies` — investment pies
- `GET /api/v0/instruments/metadata/ticker/{ticker}` — instrument details

All responses cached in Redis. Falls back to mock data if API key not set.
