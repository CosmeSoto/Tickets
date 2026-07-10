#!/usr/bin/env bash
# Instala cron horario para backups pgBackRest automáticos (Debian/producción).
# Uso: ./docker/scripts/setup-backup-cron.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
CRON_TAG="# tickets-backup-cron"

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
  echo "Generando CRON_SECRET en $ENV_FILE..."
  CRON_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)"
  echo "CRON_SECRET=$CRON_SECRET" >> "$ENV_FILE"
  echo "✅ CRON_SECRET añadido — reinicia la app: docker compose ... up -d app"
fi

if [ -z "$NEXTAUTH_URL" ]; then
  echo "ERROR: NEXTAUTH_URL no definido en $ENV_FILE"
  exit 1
fi

mkdir -p "$LOG_DIR"
BACKUP_URL="${NEXTAUTH_URL%/}/api/admin/cron/backup"
LOG_FILE="$LOG_DIR/backup-cron.log"

CRON_LINE="0 * * * * curl -fsS -X POST \"$BACKUP_URL\" -H \"Authorization: Bearer $CRON_SECRET\" >> \"$LOG_FILE\" 2>&1 $CRON_TAG"

echo "==> URL del cron: $BACKUP_URL"
echo "==> Log: $LOG_FILE"
echo "==> Línea crontab:"
echo "    $CRON_LINE"
echo ""

# Quitar entrada anterior del mismo proyecto
( crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true
  echo "$CRON_LINE"
) | crontab -

echo "✅ Crontab instalado para $(whoami)"
echo ""
echo "Verificación manual (debe responder JSON con ran/reason):"
echo "  curl -fsS -X POST \"$BACKUP_URL\" -H \"Authorization: Bearer \$CRON_SECRET\""
echo ""
echo "Nota: reinicia tickets-app si acabas de añadir CRON_SECRET:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production up -d app"
