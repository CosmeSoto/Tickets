#!/bin/bash
set -e

STANZA="${PGBACKREST_STANZA:-main}"
PGBR_CONF="/etc/pgbackrest/pgbackrest-local.conf"
MARKER="/var/lib/pgbackrest/.bootstrap_done"

# Los volúmenes Docker montan como root — pgBackRest debe escribir como postgres (uid 999)
for dir in /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest /var/run/postgresql; do
  mkdir -p "$dir"
  chown -R postgres:postgres "$dir" 2>/dev/null || true
  chmod 750 "$dir" 2>/dev/null || true
done
chmod 775 /var/run/postgresql 2>/dev/null || true

# Interceptar "postgres" para inyectar archive_mode según bootstrap
if [ "${1:-}" = "postgres" ]; then
  shift
  PG_ARGS=(
    -c wal_level=replica
    -c max_wal_senders=3
    -c archive_timeout=60
  )
  if [ -f "$MARKER" ]; then
    echo "[pgBackRest] Repositorio listo — archive_mode=on"
    PG_ARGS+=(
      -c archive_mode=on
      -c "archive_command=pgbackrest --config=${PGBR_CONF} --stanza=${STANZA} archive-push %p"
    )
  else
    echo "[pgBackRest] Bootstrap pendiente — archive_mode=off"
    PG_ARGS+=(-c archive_mode=off)
  fi
  exec /usr/local/bin/docker-entrypoint.sh postgres "${PG_ARGS[@]}" "$@"
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
