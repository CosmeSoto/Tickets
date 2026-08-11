#!/usr/bin/env bash
# Instala cron de polling de Telegram (cada 30 s) en el host.
#
# Úsalo solo si tu sistema está en red local sin URL pública.
# Cuando tengas hosting con dominio público, usa "Registrar Webhook"
# en Admin → Configuración → Telegram y elimina este cron.
#
# Uso: ./docker/scripts/setup-telegram-poll-cron.sh
# Para desinstalar: ./docker/scripts/setup-telegram-poll-cron.sh --remove

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
CRON_TAG="# tickets-telegram-poll-cron"

# ── Modo --remove ─────────────────────────────────────────────────────────────
if [ "${1:-}" = "--remove" ]; then
  echo "==> Eliminando cron de Telegram polling..."
  (crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true) | crontab -
  echo "✅ Cron de Telegram polling eliminado."
  echo ""
  echo "Si ya tienes un webhook activo en producción no necesitas este cron."
  exit 0
fi

# ── Verificar env ─────────────────────────────────────────────────────────────
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
  echo "ERROR: CRON_SECRET no definido en $ENV_FILE"
  exit 1
fi
if [ -z "$NEXTAUTH_URL" ]; then
  echo "ERROR: NEXTAUTH_URL no definido en $ENV_FILE"
  exit 1
fi

mkdir -p "$LOG_DIR"

POLL_URL="${NEXTAUTH_URL%/}/api/cron/telegram-poll"
LOG_FILE="$LOG_DIR/telegram-poll-cron.log"

# Crontab estándar no soporta intervalos < 1 min.
# Se usan DOS líneas: una en el minuto exacto y otra 30 s después.
CRON_LINE_A="* * * * * curl -fsS \"$POLL_URL\" -H \"Authorization: Bearer $CRON_SECRET\" >> \"$LOG_FILE\" 2>&1 $CRON_TAG"
CRON_LINE_B="* * * * * sleep 30 && curl -fsS \"$POLL_URL\" -H \"Authorization: Bearer $CRON_SECRET\" >> \"$LOG_FILE\" 2>&1 $CRON_TAG"

echo "==> URL del poll: $POLL_URL"
echo "==> Log: $LOG_FILE"
echo ""
echo "==> Líneas crontab (cada 30 s):"
echo "    $CRON_LINE_A"
echo "    $CRON_LINE_B"
echo ""

(
  crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true
  echo "$CRON_LINE_A"
  echo "$CRON_LINE_B"
) | crontab -

echo "✅ Cron de Telegram polling instalado para $(whoami)"
echo ""
echo "Prueba manual (debe devolver {\"success\":true,\"processed\":N}):"
echo "  curl -s \"$POLL_URL\" -H \"Authorization: Bearer \$CRON_SECRET\""
echo ""
echo "Ver logs en tiempo real:"
echo "  tail -f \"$LOG_FILE\""
echo ""
echo "Para DESINSTALAR (cuando tengas webhook en producción):"
echo "  ./docker/scripts/setup-telegram-poll-cron.sh --remove"
