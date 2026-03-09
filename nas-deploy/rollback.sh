#!/bin/bash
set -e

TAG="${1:?Usage: ./rollback.sh <image-tag>}"
COMPOSE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/docker-compose.yml"

echo "Rolling back to $TAG..."
sed -i "s|wtr24/t212-api:.*|wtr24/t212-api:${TAG}|g" "$COMPOSE_FILE"
sed -i "s|wtr24/t212-client:.*|wtr24/t212-client:${TAG}|g" "$COMPOSE_FILE"

docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

sleep 15
STATUS=$(curl -sf http://localhost:5002/api/health -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
echo "Health after rollback: $STATUS"
[ "$STATUS" = "200" ] && echo "✅ Rollback to $TAG successful" || echo "❌ Rollback failed — check logs"
