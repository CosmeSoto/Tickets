#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-domain-mac.sh  —  macOS / Linux
# Configura el dominio local para acceder al sistema desde este equipo.
#
# Uso:
#   sudo bash setup-domain-mac.sh
#
# Para desinstalar:
#   sudo bash setup-domain-mac.sh --remove
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/domain-config.txt"

# Leer configuración
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ No se encontró domain-config.txt en $SCRIPT_DIR"
  exit 1
fi

SERVER_IP=$(grep "^SERVER_IP=" "$CONFIG_FILE" | cut -d'=' -f2 | tr -d ' \r')
DOMAIN=$(grep "^DOMAIN=" "$CONFIG_FILE" | cut -d'=' -f2 | tr -d ' \r')

if [ -z "$SERVER_IP" ] || [ -z "$DOMAIN" ]; then
  echo "❌ SERVER_IP o DOMAIN no definidos en domain-config.txt"
  exit 1
fi

HOSTS_FILE="/etc/hosts"
MARKER="# gestion-local-domain"

# ── Modo desinstalar ──────────────────────────────────────────────────────────
if [ "$1" = "--remove" ]; then
  if grep -q "$MARKER" "$HOSTS_FILE"; then
    sed -i '' "/$MARKER/d" "$HOSTS_FILE"
    echo "✅ Dominio '$DOMAIN' eliminado de $HOSTS_FILE"
  else
    echo "ℹ️  No se encontró entrada de '$DOMAIN' en $HOSTS_FILE"
  fi
  exit 0
fi

# ── Modo instalar ─────────────────────────────────────────────────────────────

# Eliminar entrada anterior si existe (para actualizar IP o dominio)
if grep -q "$MARKER" "$HOSTS_FILE"; then
  sed -i '' "/$MARKER/d" "$HOSTS_FILE"
  echo "🔄 Entrada anterior eliminada (actualizando...)"
fi

# Agregar nueva entrada
echo "$SERVER_IP    $DOMAIN www.$DOMAIN $MARKER" >> "$HOSTS_FILE"

echo ""
echo "✅ Configurado correctamente:"
echo "   Dominio : $DOMAIN"
echo "   IP      : $SERVER_IP"
echo ""
echo "🌐 Abre en tu navegador: http://$DOMAIN"
echo ""
echo "💡 Para actualizar la IP o el dominio:"
echo "   1. Edita scripts/domain-config.txt"
echo "   2. Vuelve a ejecutar: sudo bash setup-domain-mac.sh"
