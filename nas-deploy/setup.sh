#!/bin/bash
set -e

DEPLOY_DIR="/volume1/docker/t212-dashboard"

command -v docker >/dev/null 2>&1 || { echo "Docker not found. Install Docker on your NAS first."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose not found. Update Docker to v2.x+"; exit 1; }

echo "Creating $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml"
cp "$SCRIPT_DIR/rollback.sh" "$DEPLOY_DIR/rollback.sh"
chmod +x "$DEPLOY_DIR/rollback.sh"

if [ ! -f "$DEPLOY_DIR/.env" ]; then
  cp "$SCRIPT_DIR/.env.example" "$DEPLOY_DIR/.env"
  echo ""
  echo "⚠️  .env created from template. Edit it before starting:"
  echo "    nano $DEPLOY_DIR/.env"
  echo ""
  echo "Required: POSTGRES_PASSWORD, T212_API_KEY"
  echo "Optional: GROQ_API_KEY, ALPHA_VANTAGE_KEY"
  exit 0
fi

cd "$DEPLOY_DIR"
echo "Pulling images..."
docker compose pull

echo "Starting services..."
docker compose up -d

echo "Waiting for services..."
sleep 20

docker compose ps

NAS_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✅ T212 Dashboard running at: http://${NAS_IP}:3002"
