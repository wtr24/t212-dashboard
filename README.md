# T212 Dashboard

Bloomberg Terminal meets Apple Vision Pro — full Trading 212 portfolio analytics with auto-deploy CI/CD.

## Stack
- React + Framer Motion + Recharts (frontend, port 3002)
- Node/Express (backend, port 5002)
- PostgreSQL 16 · Redis 7
- Docker · GitHub Actions · Watchtower

---

## CI/CD Pipeline

Every `git push` to `main`:

```
push → test + build client → build & push Docker images (latest + sha tag)
     → SSH into NAS → docker compose pull → up -d
     → healthcheck /api/health → Discord notification
     → on fail: auto-rollback to previous sha tag
```

### GitHub Secrets Required

Go to: **Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `DOCKER_USERNAME` | Your Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub → Account Settings → Security → New Access Token |
| `NAS_HOST` | `192.168.0.18` |
| `NAS_SSH_USER` | NAS SSH username (e.g. `admin`) |
| `NAS_SSH_KEY` | ED25519 private key — see `scripts/generate-ssh-key.md` |
| `DISCORD_WEBHOOK` | Discord channel → Edit → Integrations → Webhooks *(optional)* |

### Generate SSH key (one time)

```powershell
ssh-keygen -t ed25519 -C "github-actions-t212" -f ~/.ssh/t212_deploy_key -N ""
# Add public key to NAS:
ssh admin@192.168.0.18 "mkdir -p ~/.ssh && echo '$(cat ~/.ssh/t212_deploy_key.pub)' >> ~/.ssh/authorized_keys"
# Then paste private key contents into NAS_SSH_KEY secret
```

Full instructions: `scripts/generate-ssh-key.md`

---

## First-Time NAS Setup

```bash
ssh admin@192.168.0.18

mkdir -p /volume1/docker/t212-dashboard
cd /volume1/docker/t212-dashboard

# Download files
curl -O https://raw.githubusercontent.com/wtr24/t212-dashboard/main/nas-deploy/docker-compose.yml
curl -O https://raw.githubusercontent.com/wtr24/t212-dashboard/main/nas-deploy/.env.example
curl -O https://raw.githubusercontent.com/wtr24/t212-dashboard/main/nas-deploy/rollback.sh
chmod +x rollback.sh

# Configure
cp .env.example .env
nano .env   # set POSTGRES_PASSWORD, T212_API_KEY, etc.

# Start
docker compose pull
docker compose up -d
```

Dashboard: `http://192.168.0.18:3002`

---

## Manual Rollback

**Option A — GitHub UI:**
Repo → Actions → Manual Rollback → Run workflow → enter `sha-<commit>` tag

**Option B — SSH directly:**
```bash
ssh admin@192.168.0.18
cd /volume1/docker/t212-dashboard
./rollback.sh sha-abc1234def
```

**Option C — locally:**
```bash
git log --oneline   # find the sha
# Go to GitHub Actions → Manual Rollback workflow → Run workflow
```

---

## Local Dev

```bash
cp server/.env.example server/.env
# Edit server/.env with your API keys

docker compose up postgres redis -d
cd server && npm install && npm start
cd client && npm install && npm start
```

---

## API Keys

| Key | Source | Free tier |
|-----|--------|-----------|
| `T212_API_KEY` | T212 app → Settings → API | Yes |
| `GROQ_API_KEY` | console.groq.com | Yes (generous) |
| `ALPHA_VANTAGE_KEY` | alphavantage.co | Yes (25 req/day) |

**T212 key:** hamburger menu → Settings → scroll to API section → Generate key

---

## Docker Images
- `wtr24/t212-api:latest` — backend
- `wtr24/t212-client:latest` — frontend
- Also tagged `:sha-<commit>` for rollback

## T212 Endpoints Integrated

- `GET /api/v0/equity/portfolio`
- `GET /api/v0/equity/account/cash`
- `GET /api/v0/equity/account/info`
- `GET /api/v0/history/orders?limit=50`
- `GET /api/v0/history/dividends?limit=50`
- `GET /api/v0/history/transactions?limit=50`
- `GET /api/v0/equity/pies`
- `GET /api/v0/instruments/metadata/ticker/{ticker}`

All cached in Redis. Falls back to mock data if no API key.
