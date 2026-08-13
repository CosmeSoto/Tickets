#!/usr/bin/env bash
# Instala cron de limpieza de tokens Telegram (diario 03:00).
#
# Uso: ./docker/scripts/setup-telegram-cleanup-cron.sh
# Desinstalar: ./docker/scripts/setup-telegram-cleanup-cron.sh --remove

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
CRON_TAG="# tickets-telegram-cleanup-cron"

if [ "${1:-}" = "--remove" ]; then
  echo "==> Eliminando cron de Telegram cleanup..."
  (crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true) | crontab -
  echo "✅ Cron de Telegram cleanup eliminado."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: no existe $ENV_FILE"
  exit 1
fi

get_env() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

CRON_SECRET="$(get_env CRON_SECRET)"
NEXTAUTH_URL="$(get_env NEXTAUTH_URL)"

if [ -z "$CRON_SECRET" ] || [ -z "$NEXTAUTH_URL" ]; then
  echo "ERROR: CRON_SECRET y NEXTAUTH_URL deben estar en $ENV_FILE"
  exit 1
fi

mkdir -p "$LOG_DIR"

CLEANUP_URL="${NEXTAUTH_URL%/}/api/cron/telegram-cleanup"
QUEUE_URL="${NEXTAUTH_URL%/}/api/cron/process-telegram-queue"
LOG_FILE="$LOG_DIR/telegram-cleanup-cron.log"
QUEUE_LOG="$LOG_DIR/telegram-queue-cron.log"

CRON_CLEANUP="0 3 * * * curl -fsS \"$CLEANUP_URL\" -H \"Authorization: Bearer $CRON_SECRET\" >> \"$LOG_FILE\" 2>&1 $CRON_TAG"
CRON_QUEUE="*/2 * * * * curl -fsS \"$QUEUE_URL\" -H \"Authorization: Bearer $CRON_SECRET\" >> \"$QUEUE_LOG\" 2>&1 $CRON_TAG-queue"

echo "==> Cleanup URL: $CLEANUP_URL"
echo "==> Queue URL:   $QUEUE_URL"
echo ""

(
  crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true
  echo "$CRON_CLEANUP"
  echo "$CRON_QUEUE"
) | crontab -

echo "✅ Crons instalados:"
echo "   - Limpieza tokens: diario 03:00"
echo "   - Cola de alertas: cada 2 minutos"
