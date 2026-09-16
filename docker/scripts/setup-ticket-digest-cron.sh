#!/usr/bin/env bash
# Instala cron cada 5 min para el digest agrupado de actividad de tickets
# (comentarios, actualizaciones menores — consolidados en un correo, no uno por evento).
# El intervalo REAL de envío (default 30 min) se configura desde
# Admin -> Configuración -> Tickets -> Reglas generales, no aquí: este cron
# solo revisa seguido si ya toca enviar (consulta barata, throttle interno
# en src/lib/cron/ticket-activity-digest.ts). Correrlo cada 5 min permite que
# el admin baje el intervalo hasta 5 min desde la UI sin tocar el servidor.
# Uso: ./docker/scripts/setup-ticket-digest-cron.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
CRON_TAG="# tickets-activity-digest-cron"

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
DIGEST_URL="${NEXTAUTH_URL%/}/api/cron/ticket-activity-digest"
LOG_FILE="$LOG_DIR/ticket-activity-digest-cron.log"

# Cada 5 minutos — el job decide internamente si ya toca enviar según el
# intervalo configurado en la UI (default 30 min); si no toca, no hace nada.
CRON_LINE="*/5 * * * * curl -fsS -X POST \"$DIGEST_URL\" -H \"Authorization: Bearer $CRON_SECRET\" >> \"$LOG_FILE\" 2>&1 $CRON_TAG"

echo "==> URL del cron: $DIGEST_URL"
echo "==> Log: $LOG_FILE"
echo "==> Línea crontab:"
echo "    $CRON_LINE"
echo ""

( crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true
  echo "$CRON_LINE"
) | crontab -

echo "✅ Crontab de digest de actividad de tickets instalado para $(whoami)"
echo ""
echo "Prueba manual:"
echo "  curl -fsS -X POST \"$DIGEST_URL\" -H \"Authorization: Bearer \$CRON_SECRET\""
echo ""
echo "Requiere que la cola de email esté activa (/api/cron/process-email-queue)."
