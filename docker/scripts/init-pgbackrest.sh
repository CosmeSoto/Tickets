#!/usr/bin/env bash
# Bootstrap pgBackRest: stanza + primer backup FULL + activar archivado WAL.
# Uso: ./docker/scripts/init-pgbackrest.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
STANZA="${PGBACKREST_STANZA:-main}"
PGBR_LOCAL="--config=/etc/pgbackrest/pgbackrest-local.conf"
MARKER="/var/lib/pgbackrest/.bootstrap_done"

cd "$PROJECT_DIR"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

pgbr() {
  compose exec -T -u postgres postgres pgbackrest $PGBR_LOCAL "$@"
}

wait_postgres() {
  echo "   Esperando PostgreSQL..."
  for i in $(seq 1 45); do
    if compose exec -T postgres psql -U tickets_user -d tickets_db -tAc \
      "SELECT NOT pg_is_in_recovery()" 2>/dev/null | grep -q t; then
      echo "   ✅ PostgreSQL respondiendo"
      return 0
    fi
    sleep 2
  done
  echo "   ERROR: PostgreSQL no respondió"
  return 1
}

echo "==> 1/5 Permisos pgBackRest..."
compose exec -T -u root postgres bash -c "
  mkdir -p /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest /var/run/postgresql
  chown -R postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest /var/run/postgresql
  chmod -R 750 /var/lib/pgbackrest /var/log/pgbackrest
  chmod 775 /var/run/postgresql
  rm -f ${MARKER}
"

wait_postgres

echo "==> 2/5 stanza-create..."
pgbr stanza-create --stanza="$STANZA" || true

echo "==> 3/5 backup FULL inicial (--no-archive-check)..."
pgbr backup --stanza="$STANZA" --type=full --no-archive-check

echo "==> 4/5 Activando archivado WAL (marcador + restart postgres)..."
compose exec -T -u root postgres bash -c "
  touch ${MARKER}
  chown postgres:postgres ${MARKER}
"
compose restart -t 20 postgres
wait_postgres

echo "==> 5/5 Verificación pgBackRest..."
pgbr check --stanza="$STANZA"
echo "✅ pgBackRest bootstrap completado"
