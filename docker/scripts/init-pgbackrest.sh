#!/usr/bin/env bash
# Bootstrap pgBackRest: stanza + primer backup FULL + activar archivado WAL.
# Uso: ./docker/scripts/init-pgbackrest.sh
# Reanuda si se interrumpió (stanza/backup parcial) — idempotente.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
STANZA="${PGBACKREST_STANZA:-main}"
PGBR_LOCAL="--config=/etc/pgbackrest/pgbackrest-local.conf"
MARKER="/var/lib/pgbackrest/.bootstrap_done"

cd "$PROJECT_DIR"

trap 'echo "   ERROR: init-pgbackrest falló en línea $LINENO (exit $?)" >&2' ERR

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

has_full_backup() {
  local info
  info=$(pgbr info --stanza="$STANZA" 2>/dev/null || true)
  echo "$info" | grep -qE 'full backup:' && return 0
  return 1
}

marker_exists() {
  compose exec -T postgres test -f "$MARKER" 2>/dev/null
}

archive_mode_on() {
  local mode
  mode=$(compose exec -T postgres psql -U tickets_user -d tickets_db -tAc \
    "SHOW archive_mode" 2>/dev/null | tr -d '[:space:]' || true)
  [ "$mode" = "on" ]
}

echo "==> 1/5 Permisos pgBackRest..."
if ! compose exec -T -u root postgres bash -c "
  mkdir -p /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest /var/run/postgresql
  chown -R postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest /var/run/postgresql
  chmod -R 750 /var/lib/pgbackrest /var/log/pgbackrest
  chmod 775 /var/run/postgresql
"; then
  echo "   ERROR: no se pudieron ajustar permisos pgBackRest (¿postgres en ejecución?)"
  exit 1
fi

echo "   pgBackRest: $(compose exec -T postgres pgbackrest version 2>/dev/null | head -1 || echo 'N/A')"

wait_postgres

if marker_exists && archive_mode_on; then
  echo "==> Marcador bootstrap ya existe — solo verificando..."
  pgbr check --stanza="$STANZA"
  echo "✅ pgBackRest ya estaba configurado"
  exit 0
fi

if marker_exists && ! archive_mode_on; then
  echo "==> Marcador presente pero archive_mode=off — reiniciando PostgreSQL..."
  compose restart -t 30 postgres
  wait_postgres
  pgbr check --stanza="$STANZA"
  echo "✅ pgBackRest archivado activado"
  exit 0
fi

echo "==> 2/5 stanza-create..."
pgbr stanza-create --stanza="$STANZA" || true

if has_full_backup; then
  echo "==> 3/5 Backup FULL ya presente — reanudando bootstrap..."
else
  echo "==> 3/5 backup FULL inicial (--no-archive-check)..."
  echo "   ⏳ Puede tardar 2–10 min — no interrumpir (Ctrl+C deja archive_mode desactivado)"
  pgbr backup --stanza="$STANZA" --type=full --no-archive-check
  echo "   ✅ Backup FULL completado"
fi

echo "==> 4/5 Activando archivado WAL (marcador + restart postgres)..."
compose exec -T -u root postgres bash -c "
  touch ${MARKER}
  chown postgres:postgres ${MARKER}
"
compose restart -t 30 postgres
wait_postgres

if ! archive_mode_on; then
  echo "   ERROR: archive_mode sigue off tras reinicio — revisa logs de postgres"
  exit 1
fi

echo "==> 5/5 Verificación pgBackRest..."
pgbr check --stanza="$STANZA"
echo "✅ pgBackRest bootstrap completado"
