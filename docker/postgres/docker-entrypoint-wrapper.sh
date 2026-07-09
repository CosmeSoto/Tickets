#!/bin/bash
set -e

# Los volúmenes Docker montan como root — pgBackRest debe escribir como postgres (uid 999)
for dir in /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest; do
  mkdir -p "$dir"
  chown -R postgres:postgres "$dir" 2>/dev/null || true
  chmod 750 "$dir" 2>/dev/null || true
done

exec /usr/local/bin/docker-entrypoint.sh "$@"
