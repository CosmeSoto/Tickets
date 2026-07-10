#!/bin/bash
# Tras crear .bootstrap_done, reinicia el contenedor para que archive_mode=on entre en vigor.
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
  echo "[pgBackRest] Marcador detectado — reiniciando PostgreSQL para activar archive_mode..."
  kill -TERM 1
  exit 0
done
