#!/usr/bin/env bash
# Repara pgBackRest cuando PostgreSQL entra en bucle "recovery mode" o falta la stanza
# Uso: ./docker/scripts/fix-pgbackrest.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

echo "==> 3. Levantando backup-worker para inicialización..."
compose up -d backup-worker
sleep 10

echo "==> 4. Inicializando stanza pgBackRest..."
COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" "$SCRIPT_DIR/init-pgbackrest.sh"

echo "==> 5. Levantando servicios..."
compose up -d

echo ""
echo "✅ Reparación completada."
echo "   Verifica: docker compose -f $COMPOSE_FILE logs postgres --tail 30"
echo "   pgBackRest: ./docker/scripts/disaster-recovery.sh check"
