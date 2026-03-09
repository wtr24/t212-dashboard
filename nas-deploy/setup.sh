#!/bin/bash
set -e

DEPLOY_DIR="/volume1/docker/t212-dashboard"
echo "T212 Dashboard NAS Setup"
echo "========================"

mkdir -p "$DEPLOY_DIR"
cp docker-compose.yml "$DEPLOY_DIR/"

if [ ! -f "$DEPLOY_DIR/.env" ]; then
  cp .env.example "$DEPLOY_DIR/.env"
  echo "Created .env - edit it with your API keys before starting!"
  echo "  nano $DEPLOY_DIR/.env"
  exit 0
fi

cd "$DEPLOY_DIR"
docker compose pull
docker compose up -d

echo ""
echo "Dashboard running at: http://$(hostname -I | awk '{print $1}'):3002"
