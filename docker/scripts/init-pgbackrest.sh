#!/usr/bin/env bash
# Inicializa pgBackRest (stanza + primer backup si hace falta).
# Uso: ./docker/scripts/init-pgbackrest.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
STANZA="${PGBACKREST_STANZA:-main}"

cd "$PROJECT_DIR"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

worker_curl() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local secret
  secret=$(grep -E '^BACKUP_WORKER_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
  if [ -z "$secret" ]; then
    echo "ERROR: BACKUP_WORKER_SECRET no definido en $ENV_FILE"
    exit 1
  fi
  if [ -n "$data" ]; then
    compose exec -T backup-worker curl -fsS -X "$method" \
      -H "Authorization: Bearer $secret" \
      -H "Content-Type: application/json" \
      -d "$data" "http://127.0.0.1:8080${path}"
  else
    compose exec -T backup-worker curl -fsS -X "$method" \
      -H "Authorization: Bearer $secret" \
      "http://127.0.0.1:8080${path}"
  fi
}

wait_postgres() {
  echo "==> Esperando PostgreSQL..."
  for i in $(seq 1 60); do
    if compose exec -T postgres psql -U tickets_user -d tickets_db -tAc \
      "SELECT NOT pg_is_in_recovery()" 2>/dev/null | grep -q t; then
      echo "✅ PostgreSQL listo"
      return 0
    fi
    sleep 3
  done
  echo "ERROR: PostgreSQL no respondió a tiempo"
  return 1
}

wait_backup_worker() {
  echo "==> Esperando backup-worker..."
  for i in $(seq 1 60); do
    if compose ps backup-worker 2>/dev/null | grep -q "Up"; then
      if compose exec -T backup-worker curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then
        echo "✅ backup-worker respondiendo"
        return 0
      fi
    fi
    sleep 3
  done
  echo "ERROR: backup-worker no respondió a tiempo"
  return 1
}

echo "==> 1. Permisos del repositorio pgBackRest..."
compose exec -u root postgres bash -c '
  mkdir -p /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest
  chown -R postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest
  chmod -R 750 /var/lib/pgbackrest /var/log/pgbackrest
'

wait_postgres

echo "==> 2. stanza-create (postgres)..."
if compose exec -u postgres postgres pgbackrest \
  --config=/etc/pgbackrest/pgbackrest-local.conf \
  stanza-create --stanza="$STANZA"; then
  echo "   stanza-create OK (postgres)"
else
  echo "   stanza-create ya existía o reintentará backup-worker"
fi

compose up -d backup-worker 2>/dev/null || true
wait_backup_worker

echo "==> 3. Inicialización vía backup-worker (stanza + backup FULL si es necesario)..."
if ! worker_curl POST /init; then
  echo "   Reiniciando backup-worker..."
  compose restart backup-worker
  sleep 20
  wait_backup_worker
  worker_curl POST /init
fi

echo "==> 4. Reiniciando PostgreSQL (activa archivado WAL)..."
compose restart postgres
wait_postgres

echo "==> 5. Verificación final..."
compose exec -u postgres backup-worker pgbackrest check --stanza="$STANZA"
echo "✅ pgBackRest inicializado"
