# NAS + CI/CD Skill
## Project: T212 Portfolio Dashboard on UGreen NAS

---

## NAS FACTS (never guess these)
- IP: 192.168.0.18
- App port: 3002 (t212-dashboard)
- Docker path: /volume1/docker/t212-dashboard/
- Docker compose: docker-compose.yml in above path
- Watchtower: polls Docker Hub every 30s, auto-deploys :latest tag
- SSH user: check NAS_SSH_KEY secret (key-based auth)
- Images: wtr24dev/t212-api:latest + wtr24dev/t212-client:latest

## ENV VARS ON NAS (.env file at /volume1/docker/t212-dashboard/.env)
```
T212_API_KEY=
GEMINI_API_KEY=
DISCORD_EARNINGS_WEBHOOK=https://discord.com/api/webhooks/1479759008784060448/...
ALPHA_VANTAGE_KEY=
TWELVE_DATA_KEY=
FMP_KEY=
POLYGON_KEY=
DATABASE_URL=postgresql://t212:t212@postgres:5432/t212
REDIS_URL=redis://redis:6379
GEMINI_MODEL=gemini-2.5-flash
```

## ADDING NEW ENV VARS TO NAS
```bash
# SSH into NAS
ssh admin@192.168.0.18

# Edit .env
nano /volume1/docker/t212-dashboard/.env
# Add: NEW_KEY=value
# Save: Ctrl+X Y Enter

# Restart containers to pick up new vars
cd /volume1/docker/t212-dashboard
docker compose up -d

# Verify key loaded
docker exec t212-dashboard-api-1 printenv NEW_KEY | head -c 10
```

## CI/CD PIPELINE (GitHub Actions)
Repo: github.com/wtr24/t212-dashboard
Branch: main → triggers auto deploy

### Workflow file: .github/workflows/deploy.yml
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build API
        run: docker build -t wtr24dev/t212-api:latest -t wtr24dev/t212-api:sha-${{ github.sha }} ./server

      - name: Build Client
        run: docker build -t wtr24dev/t212-client:latest -t wtr24dev/t212-client:sha-${{ github.sha }} ./client

      - name: Push to Docker Hub
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push wtr24dev/t212-api:latest
          docker push wtr24dev/t212-api:sha-${{ github.sha }}
          docker push wtr24dev/t212-client:latest
          docker push wtr24dev/t212-client:sha-${{ github.sha }}

      - name: Deploy to NAS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.NAS_HOST }}
          username: admin
          key: ${{ secrets.NAS_SSH_KEY }}
          script: |
            cd /volume1/docker/t212-dashboard
            docker compose pull
            docker compose up -d
            sleep 15
            curl -sf http://localhost:5002/health || exit 1

      - name: Notify Discord
        if: always()
        run: |
          STATUS="${{ job.status }}"
          COLOR=$([[ "$STATUS" == "success" ]] && echo "3066993" || echo "15158332")
          curl -s -X POST "${{ secrets.DISCORD_WEBHOOK }}" \
            -H "Content-Type: application/json" \
            -d "{\"embeds\":[{\"title\":\"Deploy $STATUS\",\"description\":\"Commit: ${{ github.event.head_commit.message }}\",\"color\":$COLOR}]}"
```

### Required GitHub Secrets
- DOCKER_USERNAME = wtr24dev
- DOCKER_PASSWORD = Docker Hub password
- NAS_HOST = 192.168.0.18
- NAS_SSH_KEY = contents of ~/.ssh/id_rsa (private key)
- DISCORD_WEBHOOK = webhook URL

### Rollback workflow: .github/workflows/rollback.yml
```yaml
name: Rollback
on:
  workflow_dispatch:
    inputs:
      sha:
        description: 'Git SHA to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Rollback on NAS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.NAS_HOST }}
          username: admin
          key: ${{ secrets.NAS_SSH_KEY }}
          script: |
            cd /volume1/docker/t212-dashboard
            sed -i 's/:latest/:sha-${{ github.event.inputs.sha }}/g' docker-compose.yml
            docker compose pull
            docker compose up -d
            sed -i 's/:sha-[a-f0-9]*/:latest/g' docker-compose.yml
```

## ADDING A NEW ENV VAR TO THE PROJECT

1. Add to .env on NAS (see above)
2. Add to docker-compose.yml under api.environment:
   ```yaml
   NEW_KEY: ${NEW_KEY}
   ```
3. Add to .env.example in repo root (no value, just key name)
4. Read in server code: process.env.NEW_KEY
5. Push → auto-deploys via Watchtower

## DOCKER COMPOSE TEMPLATE
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: t212
      POSTGRES_USER: t212
      POSTGRES_PASSWORD: t212
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  api:
    image: wtr24dev/t212-api:latest
    labels:
      - com.centurylinklabs.watchtower.enable=true
    ports:
      - "5002:5002"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      T212_API_KEY: ${T212_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      GEMINI_MODEL: ${GEMINI_MODEL:-gemini-2.5-flash}
      ALPHA_VANTAGE_KEY: ${ALPHA_VANTAGE_KEY}
      TWELVE_DATA_KEY: ${TWELVE_DATA_KEY}
      FMP_KEY: ${FMP_KEY}
      POLYGON_KEY: ${POLYGON_KEY}
      DISCORD_EARNINGS_WEBHOOK: ${DISCORD_EARNINGS_WEBHOOK}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  client:
    image: wtr24dev/t212-client:latest
    labels:
      - com.centurylinklabs.watchtower.enable=true
    ports:
      - "3002:80"
    depends_on:
      - api
    restart: unless-stopped

  watchtower:
    image: containrrr/watchtower
    command: --interval 30 --cleanup --label-enable
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
```

## DEBUGGING ON NAS
```bash
# View logs
docker logs t212-dashboard-api-1 --tail 50 -f
docker logs t212-dashboard-client-1 --tail 20

# Check all containers
docker compose ps

# Execute command in container
docker exec t212-dashboard-api-1 node -e "console.log(process.env.GEMINI_API_KEY?.slice(0,5))"

# Check DB
docker exec t212-dashboard-postgres-1 psql -U t212 -d t212 -c "SELECT COUNT(*) FROM earnings_calendar;"

# Force pull latest images
docker compose pull && docker compose up -d

# Check port open
curl -s http://192.168.0.18:5002/health
curl -s http://192.168.0.18:3002
```

## COMMON ISSUES
- Container won't start: check docker logs, usually missing env var
- New env var not picked up: docker compose up -d (NOT just restart)
- Port conflict: check docker compose ps and lsof -i :PORT
- DB migration not run: add to server/index.js startup sequence
- Watchtower not deploying: check label com.centurylinklabs.watchtower.enable=true exists
