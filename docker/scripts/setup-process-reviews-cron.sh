#!/usr/bin/env bash
# Instala cron diario (08:15) para revisiones vencidas del módulo Procesos.
# Uso: ./docker/scripts/setup-process-reviews-cron.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
CRON_TAG="# tickets-process-reviews"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: no existe $ENV_FILE"
  exit 1
fi

get_env() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

CRON_SECRET="$(get_env CRON_SECRET)"
NEXTAUTH_URL="$(get_env NEXTAUTH_URL)"

if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: CRON_SECRET no definido. Ejecuta antes: ./docker/scripts/setup-backup-cron.sh"
  exit 1
fi

if [ -z "$NEXTAUTH_URL" ]; then
  echo "ERROR: NEXTAUTH_URL no definido en $ENV_FILE"
  exit 1
fi

mkdir -p "$LOG_DIR"
REVIEW_URL="${NEXTAUTH_URL%/}/api/cron/process-reviews"
LOG_FILE="$LOG_DIR/process-reviews-cron.log"

# Diario 08:15 — el job reavisa cada 7 días por proceso vía lastReviewReminderAt
CRON_LINE="15 8 * * * curl -fsS \"$REVIEW_URL\" -H \"Authorization: Bearer $CRON_SECRET\" >> \"$LOG_FILE\" 2>&1 $CRON_TAG"

echo "==> URL del cron: $REVIEW_URL"
echo "==> Log: $LOG_FILE"
echo "==> Línea crontab:"
echo "    $CRON_LINE"
echo ""

( crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true
  echo "$CRON_LINE"
) | crontab -

echo "✅ Crontab de revisiones de procesos instalado para $(whoami)"
echo ""
echo "Prueba manual:"
echo "  curl -fsS \"$REVIEW_URL\" -H \"Authorization: Bearer \$CRON_SECRET\""
echo ""
echo "Requiere colas activas:"
echo "  /api/cron/process-email-queue"
echo "  /api/cron/process-telegram-queue (si usa Telegram)"
