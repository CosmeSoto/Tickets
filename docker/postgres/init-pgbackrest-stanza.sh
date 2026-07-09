#!/bin/bash
# Ejecutado solo en la primera inicialización del cluster (docker-entrypoint-initdb.d)
set -e

echo "[pgBackRest] Creando stanza en primer arranque..."
gosu postgres pgbackrest \
  --config=/etc/pgbackrest/pgbackrest-local.conf \
  stanza-create --stanza=main 2>/dev/null || true

gosu postgres pgbackrest \
  --config=/etc/pgbackrest/pgbackrest-local.conf \
  check --stanza=main 2>/dev/null || true

echo "[pgBackRest] Stanza inicializada"
