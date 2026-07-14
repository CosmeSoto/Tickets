#!/usr/bin/env bash
# Recuperación ante desastres — pgBackRest
# Uso:
#   ./docker/scripts/disaster-recovery.sh restore --latest
#   ./docker/scripts/disaster-recovery.sh restore --set 20260708-120000F
#   ./docker/scripts/disaster-recovery.sh pitr "2026-07-08 14:30:00"
#   ./docker/scripts/disaster-recovery.sh check
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
STANZA="${PGBACKREST_STANZA:-main}"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

worker_curl() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local secret
  secret=$(grep -E '^BACKUP_WORKER_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
  if [ -z "$secret" ]; then
    echo "ERROR: BACKUP_WORKER_SECRET no definido en $ENV_FILE"
    exit 1
  fi
  if [ -n "$data" ]; then
    compose exec -T backup-worker curl -fsS -X "$method" \
      -H "Authorization: Bearer $secret" \
      -H "Content-Type: application/json" \
      -d "$data" "http://127.0.0.1:8080${path}"
  else
    compose exec -T backup-worker curl -fsS -X "$method" \
      -H "Authorization: Bearer $secret" \
      "http://127.0.0.1:8080${path}"
  fi
}

cmd="${1:-help}"

case "$cmd" in
  check)
    compose exec -u postgres postgres pgbackrest \
      --config=/etc/pgbackrest/pgbackrest-local.conf check --stanza="$STANZA"
    ;;
  info)
    worker_curl GET /info | jq .
    ;;
  backup-full)
    echo "==> Deteniendo app para backup consistente..."
    compose stop app nginx || true
    worker_curl POST /backup '{"type":"full"}'
    compose up -d app nginx
    ;;
  backup-diff)
    worker_curl POST /backup '{"type":"diff"}'
    ;;
  restore)
    echo "⚠️  MODO MANTENIMIENTO — deteniendo app, nginx y postgres"
    compose stop app nginx
    compose stop postgres
    shift
    set_arg=""
    if [ "${1:-}" = "--latest" ]; then
      set_arg=""
    elif [ "${1:-}" = "--set" ] && [ -n "${2:-}" ]; then
      set_arg="$2"
    else
      echo "Uso: restore --latest | restore --set LABEL"
      exit 1
    fi
    payload='{"uiAuthorized":true}'
    if [ -n "$set_arg" ]; then
      payload="{\"set\":\"$set_arg\",\"uiAuthorized\":true}"
    fi
    worker_curl POST /restore "$payload"
    echo "==> Reiniciando servicios..."
    compose up -d postgres backup-worker app nginx
    ;;
  pitr)
    target="${2:-}"
    if [ -z "$target" ]; then
      echo "Uso: pitr \"YYYY-MM-DD HH:MM:SS\""
      exit 1
    fi
    echo "⚠️  PITR a $target — deteniendo app, nginx y postgres"
    compose stop app nginx
    compose stop postgres
    worker_curl POST /restore "{\"target\":\"$target\",\"uiAuthorized\":true}"
    echo "==> Reiniciando servicios..."
    compose up -d postgres backup-worker app nginx
    ;;
  verify)
    worker_curl POST /verify
    ;;
  *)
    cat <<EOF
Comandos:
  check          — pgbackrest check
  info           — estado del repositorio (JSON)
  backup-full    — backup completo (detiene app brevemente)
  backup-diff    — backup diferencial
  restore --latest | restore --set LABEL
  pitr "YYYY-MM-DD HH:MM:SS"
  verify         — verificar integridad del repositorio
EOF
    ;;
esac
