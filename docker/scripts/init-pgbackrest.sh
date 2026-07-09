#!/usr/bin/env bash
# Inicializa pgBackRest (stanza + primer backup si hace falta).
# Uso: ./docker/scripts/init-pgbackrest.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
STANZA="${PGBACKREST_STANZA:-main}"
PGBR_LOCAL="--config=/etc/pgbackrest/pgbackrest-local.conf"

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

wait_backup_worker_http() {
  echo "==> Esperando backup-worker (HTTP)..."
  for i in $(seq 1 40); do
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

restart_backup_worker() {
  echo "   Deteniendo backup-worker (timeout 15s)..."
  compose stop -t 15 backup-worker 2>/dev/null || compose kill backup-worker 2>/dev/null || true
  compose up -d backup-worker
  wait_backup_worker_http
}

pgbr_check() {
  compose exec -u postgres backup-worker pgbackrest $PGBR_LOCAL check --stanza="$STANZA"
}

pgbr_backup_full_postgres() {
  echo "   Backup FULL desde contenedor postgres..."
  compose exec -u postgres postgres pgbackrest $PGBR_LOCAL \
    backup --stanza="$STANZA" --type=full --no-archive-check
}

echo "==> 1. Permisos del repositorio pgBackRest..."
compose exec -u root postgres bash -c '
  mkdir -p /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest /var/run/postgresql
  chown -R postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest /var/run/postgresql
  chmod -R 750 /var/lib/pgbackrest /var/log/pgbackrest
  chmod 775 /var/run/postgresql
'

wait_postgres

echo "==> 2. stanza-create (postgres)..."
compose exec -u postgres postgres pgbackrest $PGBR_LOCAL \
  stanza-create --stanza="$STANZA" || true

compose up -d backup-worker 2>/dev/null || true
wait_backup_worker_http || restart_backup_worker

echo "==> 3. Inicialización pgBackRest..."
if worker_curl POST /init 2>/dev/null; then
  echo "   init vía backup-worker OK"
elif pgbr_backup_full_postgres && pgbr_check; then
  echo "   init vía postgres OK"
else
  restart_backup_worker
  worker_curl POST /init || pgbr_backup_full_postgres
  pgbr_check
fi

echo "==> 4. Reiniciando PostgreSQL (activa archivado WAL)..."
compose restart postgres
wait_postgres

echo "==> 5. Verificación final..."
pgbr_check
echo "✅ pgBackRest inicializado"
