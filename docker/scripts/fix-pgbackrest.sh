#!/usr/bin/env bash
# Repara pgBackRest — re-ejecuta bootstrap completo
# Uso: ./docker/scripts/fix-pgbackrest.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

echo "==> 1. Deteniendo app, worker y nginx..."
compose stop app backup-worker nginx 2>/dev/null || true

echo "==> 2. Bootstrap pgBackRest..."
COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" "$SCRIPT_DIR/init-pgbackrest.sh"

echo "==> 3. Levantando servicios..."
compose up -d

echo ""
echo "✅ Reparación completada."
echo "   ./docker/scripts/disaster-recovery.sh check"
