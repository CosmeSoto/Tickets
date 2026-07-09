#!/bin/bash
# Ejecutado solo en la primera inicialización del cluster (docker-entrypoint-initdb.d)
set -e

echo "[pgBackRest] Creando stanza en primer arranque..."
if ! gosu postgres pgbackrest \
  --config=/etc/pgbackrest/pgbackrest-local.conf \
  stanza-create --stanza=main; then
  echo "[pgBackRest] ADVERTENCIA: stanza-create falló en initdb (se reintentará vía backup-worker)"
fi

if gosu postgres pgbackrest \
  --config=/etc/pgbackrest/pgbackrest-local.conf \
  check --stanza=main; then
  echo "[pgBackRest] Stanza inicializada"
else
  echo "[pgBackRest] check pendiente — backup-worker completará la inicialización"
fi
