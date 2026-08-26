#!/usr/bin/env bash
# Instala cron diario (07:00) para las alertas de Inventario:
# vencimiento de contratos/licencias/rentas, gobernanza de suscripciones,
# stock bajo, vencimiento de MRO/garantías y vencimiento de asignaciones.
# Uso: ./docker/scripts/setup-inventory-alerts-cron.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
CRON_TAG="# tickets-inventory-alerts-cron"

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
ALERTS_URL="${NEXTAUTH_URL%/}/api/cron/inventory-alerts"
LOG_FILE="$LOG_DIR/inventory-alerts-cron.log"

# Diario 07:00 — cada check es idempotente (no reenvía alertas ya notificadas hoy)
CRON_LINE="0 7 * * * curl -fsS \"$ALERTS_URL\" -H \"Authorization: Bearer $CRON_SECRET\" >> \"$LOG_FILE\" 2>&1 $CRON_TAG"

echo "==> URL del cron: $ALERTS_URL"
echo "==> Log: $LOG_FILE"
echo "==> Línea crontab:"
echo "    $CRON_LINE"
echo ""

( crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true
  echo "$CRON_LINE"
) | crontab -

echo "✅ Crontab de alertas de inventario instalado para $(whoami)"
echo ""
echo "Prueba manual:"
echo "  curl -fsS \"$ALERTS_URL\" -H \"Authorization: Bearer \$CRON_SECRET\""
echo ""
echo "Cubre (según toggles en Inventario → Configuración → Reglas generales):"
echo "  - Vencimiento de contratos (60/30/15 días) + gobernanza de suscripciones en riesgo"
echo "  - Vencimiento de licencias y rentas"
echo "  - Stock bajo de suministros"
echo "  - Vencimiento de MRO y garantías"
echo "  - Vencimiento de asignaciones de equipos (siempre activo)"
