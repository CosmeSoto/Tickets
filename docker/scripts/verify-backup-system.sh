#!/usr/bin/env bash
# Verificación rápida del stack de backups (dev o prod).
# Uso:
#   ./docker/scripts/verify-backup-system.sh
#   COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env.production ./docker/scripts/verify-backup-system.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
ENV_FILE="${ENV_FILE:-}"
WORKER_SERVICE="${WORKER_SERVICE:-backup-worker}"
APP_SERVICE="${APP_SERVICE:-app}"

compose() {
  if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
  else
    docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

echo "==> Compose: $COMPOSE_FILE"
echo "==> Estado de contenedores"
compose ps

echo ""
echo "==> Health backup-worker"
health="$(compose exec -T "$WORKER_SERVICE" curl -fsS http://127.0.0.1:8080/health)"
echo "$health"

echo "$health" | grep -q '"asyncRestore":true' || {
  echo "ERROR: backup-worker sin restore asíncrono — rebuild backup-worker"
  exit 1
}

echo "$health" | grep -q '"stanzaOk":true' || {
  echo "ADVERTENCIA: stanzaOk=false — espera bootstrap o pulsa Inicializar en Admin → Backups → Config"
  exit 1
}

echo "$health" | grep -q '"dockerOk":true' || {
  echo "ADVERTENCIA: dockerOk=false — restauración pgBackRest no podrá detener contenedores."
  echo "  Mac: DOCKER_GID=1 en .env | Linux: DOCKER_GID=\$(getent group docker | cut -d: -f3)"
  echo "  Recrea backup-worker: docker compose ... up -d backup-worker --force-recreate"
  exit 1
}

echo ""
echo "==> Healthcheck interno (mismo comando que Docker)"
compose exec -T "$WORKER_SERVICE" sh -c 'curl -fsS http://127.0.0.1:8080/health | grep -qF "stanzaOk\":true"'
echo "Healthcheck grep: OK"

echo ""
echo "==> Backup FULL de prueba (worker API)"
compose exec -T "$WORKER_SERVICE" sh -c \
  'curl -fsS -X POST -H "Authorization: Bearer $BACKUP_WORKER_SECRET" -H "Content-Type: application/json" -d "{\"type\":\"full\"}" http://127.0.0.1:8080/backup'
echo ""

if compose ps "$APP_SERVICE" 2>/dev/null | grep -qE 'Up|running'; then
  echo ""
  echo "==> App respondiendo"
  if compose exec -T "$APP_SERVICE" curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/ 2>/dev/null; then
    :
  else
    echo "ADVERTENCIA: app aún no responde en :3000 (puede estar compilando en dev)"
  fi
fi

echo ""
echo "OK — infraestructura pgBackRest operativa."
