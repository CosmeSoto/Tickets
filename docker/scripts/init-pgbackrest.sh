#!/usr/bin/env bash
# Inicializa pgBackRest (stanza + primer backup) — opera desde postgres (UID correcto).
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

pgbr() {
  compose exec -u postgres postgres pgbackrest $PGBR_LOCAL "$@"
}

wait_postgres() {
  echo "==> Esperando PostgreSQL..."
  for i in $(seq 1 40); do
    if compose exec -T postgres psql -U tickets_user -d tickets_db -tAc \
      "SELECT NOT pg_is_in_recovery()" 2>/dev/null | grep -q t; then
      echo "✅ PostgreSQL listo"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: PostgreSQL no respondió a tiempo"
  return 1
}

echo "==> 1. Permisos pgBackRest + socket..."
compose exec -u root postgres bash -c '
  mkdir -p /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest /var/run/postgresql
  chown -R postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest /var/run/postgresql
  chmod -R 750 /var/lib/pgbackrest /var/log/pgbackrest
  chmod 775 /var/run/postgresql
'

wait_postgres

echo "==> 2. stanza-create..."
pgbr stanza-create --stanza="$STANZA" 2>/dev/null || true

echo "==> 3. check / backup FULL inicial..."
if ! pgbr check --stanza="$STANZA" 2>/dev/null; then
  echo "   Ejecutando backup FULL (--no-archive-check)..."
  pgbr backup --stanza="$STANZA" --type=full --no-archive-check
  pgbr check --stanza="$STANZA"
fi

echo "==> 4. Reiniciando PostgreSQL (archivado WAL)..."
compose restart postgres
wait_postgres

echo "==> 5. Verificación final..."
pgbr check --stanza="$STANZA"

# Refrescar backup-worker si está corriendo
if compose ps backup-worker 2>/dev/null | grep -q "Up"; then
  compose restart -t 10 backup-worker 2>/dev/null || true
fi

echo "✅ pgBackRest inicializado"
