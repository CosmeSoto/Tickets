#!/bin/bash
# Tras crear .bootstrap_done, reinicia el contenedor para que archive_mode=on entre en vigor.
# Espera a que no haya consultas activas (p. ej. seed/migraciones) para no tumbar la app.
MARKER="/var/lib/pgbackrest/.bootstrap_done"
PGUSER="${POSTGRES_USER:-postgres}"
PGDB="${POSTGRES_DB:-postgres}"

sleep 15
while true; do
  sleep 5
  if [ ! -f "$MARKER" ]; then
    continue
  fi
  if ! pg_isready -U "$PGUSER" -d "$PGDB" >/dev/null 2>&1; then
    continue
  fi
  mode=$(psql -U "$PGUSER" -d "$PGDB" -tAc "SHOW archive_mode" 2>/dev/null | tr -d '[:space:]')
  if [ "$mode" = "on" ]; then
    exit 0
  fi

  # Evitar reinicio a mitad de seed/db push: esperar conexiones no-idle ajenas
  quiet=0
  for _ in $(seq 1 36); do
    active=$(psql -U "$PGUSER" -d "$PGDB" -tAc \
      "SELECT count(*) FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
         AND state IN ('active', 'idle in transaction')" 2>/dev/null | tr -d '[:space:]')
    if [ -z "$active" ]; then
      active=99
    fi
    if [ "$active" = "0" ]; then
      quiet=$((quiet + 1))
      # ~15s estables sin trabajo activo
      if [ "$quiet" -ge 3 ]; then
        break
      fi
    else
      quiet=0
    fi
    sleep 5
  done

  mode=$(psql -U "$PGUSER" -d "$PGDB" -tAc "SHOW archive_mode" 2>/dev/null | tr -d '[:space:]')
  if [ "$mode" = "on" ]; then
    exit 0
  fi
  if [ ! -f "$MARKER" ]; then
    continue
  fi

  echo "[pgBackRest] Marcador detectado — reiniciando PostgreSQL para activar archive_mode..."
  kill -TERM 1
  exit 0
done
