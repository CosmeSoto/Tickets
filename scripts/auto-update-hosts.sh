#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# auto-update-hosts.sh — macOS
#
# Detecta la IP actual del Mac y actualiza /etc/hosts automáticamente.
# Una vez instalado como servicio, no necesitas hacer nada más cuando
# cambie la IP.
#
# PRIMERA VEZ (instalar el servicio):
#   sudo bash scripts/auto-update-hosts.sh --install
#
# Si cambias de IP manualmente y no quieres esperar:
#   sudo bash scripts/auto-update-hosts.sh
#
# Desinstalar el servicio:
#   sudo bash scripts/auto-update-hosts.sh --uninstall
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/domain-config.txt"
PLIST_FILE="/Library/LaunchDaemons/local.gestion.update-hosts.plist"
INSTALLED_SCRIPT="/usr/local/bin/gestion-update-hosts.sh"
MARKER="# gestion-local-domain"
HOSTS_FILE="/etc/hosts"

# Leer dominio del config
DOMAIN=$(grep "^DOMAIN=" "$CONFIG_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d ' \r')
DOMAIN="${DOMAIN:-gestion.local}"

# ── Detectar IP actual ────────────────────────────────────────────────────────
get_current_ip() {
  for iface in en0 en1 en2 en3; do
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null)
    if [ -n "$ip" ]; then
      echo "$ip"
      return
    fi
  done
  # Fallback: primera IP no-loopback
  ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1
}

# ── Actualizar /etc/hosts ─────────────────────────────────────────────────────
update_hosts() {
  local current_ip
  current_ip=$(get_current_ip)

  if [ -z "$current_ip" ]; then
    echo "$(date): Sin red activa, omitiendo" >> /var/log/gestion-update-hosts.log
    return 1
  fi

  # Eliminar entrada anterior y agregar la nueva
  sed -i '' "/$MARKER/d" "$HOSTS_FILE" 2>/dev/null
  echo "$current_ip    $DOMAIN www.$DOMAIN $MARKER" >> "$HOSTS_FILE"

  # Limpiar caché DNS
  dscacheutil -flushcache 2>/dev/null
  killall -HUP mDNSResponder 2>/dev/null

  echo "$(date): $DOMAIN → $current_ip" >> /var/log/gestion-update-hosts.log
}

# ── Instalar como servicio del sistema ────────────────────────────────────────
install() {
  echo "📦 Instalando servicio de actualización automática..."

  # Copiar script a ubicación permanente del sistema
  cp "$0" "$INSTALLED_SCRIPT"
  chmod +x "$INSTALLED_SCRIPT"

  # Crear LaunchDaemon: se ejecuta al arrancar y cada 5 minutos
  cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>local.gestion.update-hosts</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$INSTALLED_SCRIPT</string>
        <string>--run</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>StandardOutPath</key>
    <string>/var/log/gestion-update-hosts.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/gestion-update-hosts.log</string>
</dict>
</plist>
EOF

  launchctl unload "$PLIST_FILE" 2>/dev/null
  launchctl load -w "$PLIST_FILE"

  # Ejecutar ahora mismo
  update_hosts

  echo ""
  echo "✅ Servicio instalado. El dominio '$DOMAIN' se actualizará solo."
  echo "   IP actual: $(get_current_ip)"
  echo "   Log: /var/log/gestion-update-hosts.log"
}

# ── Desinstalar ───────────────────────────────────────────────────────────────
uninstall() {
  launchctl unload "$PLIST_FILE" 2>/dev/null
  rm -f "$PLIST_FILE" "$INSTALLED_SCRIPT"
  sed -i '' "/$MARKER/d" "$HOSTS_FILE" 2>/dev/null
  echo "✅ Servicio desinstalado."
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "$1" in
  --install)   install ;;
  --uninstall) uninstall ;;
  --run)       update_hosts ;;   # llamado por el servicio automático
  *)
    # Sin argumento: actualizar ahora manualmente
    update_hosts
    echo "✅ $DOMAIN → $(get_current_ip)"
    ;;
esac
