#!/usr/bin/env bash
# Borra volúmenes y levanta dev limpio (BD + pgBackRest + caché Next).
# Uso: ./docker/scripts/reset-dev-from-scratch.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.dev.yml}"

cd "$PROJECT_DIR"

echo "==> Deteniendo stack y eliminando volúmenes..."
docker compose -f "$COMPOSE_FILE" down -v --remove-orphans

echo "==> Reconstruyendo e iniciando..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "✅ Entorno dev limpio. Espera ~2 min la primera compilación de Next.js."
echo "   URL: http://localhost:3000"
echo "   Login seed: internet.freecom@gmail.com / admin123"
echo ""
echo "   Logs app:  docker logs -f tickets-app-dev"
echo "   Logs worker: docker logs -f tickets-backup-worker-dev"
