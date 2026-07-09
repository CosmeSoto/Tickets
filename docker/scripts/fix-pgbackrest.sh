#!/usr/bin/env bash
# Repara pgBackRest cuando PostgreSQL entra en bucle "recovery mode"
# Uso: ./docker/scripts/fix-pgbackrest.sh
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

echo "==> 1. Deteniendo app y backup-worker (postgres sigue activo)..."
compose stop app backup-worker nginx 2>/dev/null || true

echo "==> 2. Arreglando permisos del repositorio pgBackRest..."
compose exec -u root postgres bash -c '
  mkdir -p /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest
  chown -R postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest
  chmod -R 750 /var/lib/pgbackrest /var/log/pgbackrest
'

echo "==> 3. Creando/verificando stanza pgBackRest..."
compose exec -u postgres postgres pgbackrest \
  --config=/etc/pgbackrest/pgbackrest-local.conf \
  stanza-create --stanza=main 2>/dev/null || true

compose exec -u postgres postgres pgbackrest \
  --config=/etc/pgbackrest/pgbackrest-local.conf \
  check --stanza=main

echo "==> 4. Reiniciando PostgreSQL..."
compose restart postgres

echo "==> 5. Esperando PostgreSQL estable (sin recovery)..."
for i in $(seq 1 30); do
  if compose exec -T postgres psql -U tickets_user -d tickets_db -tAc \
    "SELECT NOT pg_is_in_recovery()" 2>/dev/null | grep -q t; then
    echo "✅ PostgreSQL estable"
    break
  fi
  echo "   intento $i/30..."
  sleep 3
done

echo "==> 6. Levantando servicios..."
compose up -d

echo ""
echo "✅ Reparación completada."
echo "   Verifica: docker compose -f $COMPOSE_FILE logs postgres --tail 30"
echo "   pgBackRest: ./docker/scripts/disaster-recovery.sh check"
