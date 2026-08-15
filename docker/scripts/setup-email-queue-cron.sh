#!/usr/bin/env bash
# Instala cron cada 2 minutos para procesar la cola de correos.
# Necesario para entrega automática de QR de Accesos y demás notificaciones por email.
# Uso: ./docker/scripts/setup-email-queue-cron.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
CRON_TAG="# tickets-email-queue"

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
QUEUE_URL="${NEXTAUTH_URL%/}/api/cron/process-email-queue"
LOG_FILE="$LOG_DIR/email-queue-cron.log"

# Cada 2 minutos — entrega de correos encolados (Accesos QR, tickets, etc.)
CRON_LINE="*/2 * * * * curl -fsS \"$QUEUE_URL\" -H \"Authorization: Bearer $CRON_SECRET\" >> \"$LOG_FILE\" 2>&1 $CRON_TAG"

echo "==> URL del cron: $QUEUE_URL"
echo "==> Log: $LOG_FILE"
echo "==> Línea crontab:"
echo "    $CRON_LINE"
echo ""

( crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true
  echo "$CRON_LINE"
) | crontab -

echo "✅ Crontab de cola de email instalado para $(whoami)"
echo ""
echo "Prueba manual:"
echo "  curl -fsS \"$QUEUE_URL\" -H \"Authorization: Bearer \$CRON_SECRET\""
echo ""
echo "Requiere SMTP habilitado en Admin → Email."
