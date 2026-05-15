#!/bin/bash
##############################################################################
# update-local-dns.sh
#
# Actualiza /etc/hosts con la IP actual de la máquina para gestion.local.
# Ejecutar con sudo antes de levantar docker compose en producción local.
#
# Uso:
#   sudo ./docker/update-local-dns.sh
#
# Qué hace:
#   1. Detecta la IP actual de la interfaz de red activa
#   2. Actualiza /etc/hosts en ESTA máquina (servidor)
#   3. Genera instrucciones para los equipos clientes de la red
#
# Para que los OTROS equipos de la red resuelvan gestion.local:
#   Opción A: Agregar la IP en /etc/hosts de cada equipo cliente
#   Opción B: Usar dnsmasq en este servidor (ver abajo)
##############################################################################

set -e

DOMAIN="gestion.local"
DOMAIN_WWW="www.gestion.local"
HOSTS_FILE="/etc/hosts"
MARKER="# gestion-local-auto"

# ── Detectar IP actual ─────────────────────────────────────────────────────────
get_local_ip() {
  # macOS: route + ifconfig
  if command -v route &>/dev/null && command -v ifconfig &>/dev/null; then
    local iface
    iface=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
    if [ -n "$iface" ]; then
      ifconfig "$iface" | awk '/inet /{print $2}' | head -1
      return
    fi
  fi
  # Fallback: hostname
  hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
}

CURRENT_IP=$(get_local_ip)

if [ -z "$CURRENT_IP" ] || [ "$CURRENT_IP" = "127.0.0.1" ]; then
  echo "❌ No se pudo detectar la IP de red local."
  echo "   Verifica que estés conectado a la red."
  exit 1
fi

echo "🌐 IP detectada: $CURRENT_IP"

# ── Actualizar /etc/hosts ──────────────────────────────────────────────────────
# Eliminar entradas anteriores de gestion.local (todas las variantes)
if grep -q "$DOMAIN" "$HOSTS_FILE" 2>/dev/null; then
  # Crear backup
  cp "$HOSTS_FILE" "${HOSTS_FILE}.bak"
  # Eliminar líneas con gestion.local
  sed -i.tmp "/$DOMAIN/d" "$HOSTS_FILE" && rm -f "${HOSTS_FILE}.tmp"
  echo "🧹 Entradas anteriores de $DOMAIN eliminadas"
fi

# Agregar nueva entrada con la IP actual
echo "$CURRENT_IP    $DOMAIN $DOMAIN_WWW $MARKER" >> "$HOSTS_FILE"
echo "✅ /etc/hosts actualizado: $CURRENT_IP → $DOMAIN"

# ── Flush DNS cache (macOS) ───────────────────────────────────────────────────
if command -v dscacheutil &>/dev/null; then
  dscacheutil -flushcache
  killall -HUP mDNSResponder 2>/dev/null || true
  echo "🔄 Caché DNS limpiada"
fi

# ── Instrucciones para equipos clientes ────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Para que OTROS equipos de la red accedan a https://$DOMAIN:"
echo ""
echo "   Opción 1 — Agregar en cada equipo cliente:"
echo "     Windows: Editar C:\\Windows\\System32\\drivers\\etc\\hosts"
echo "     Mac/Linux: sudo nano /etc/hosts"
echo "     Agregar:  $CURRENT_IP    $DOMAIN $DOMAIN_WWW"
echo ""
echo "   Opción 2 — Configurar DNS del router:"
echo "     Agregar registro A: $DOMAIN → $CURRENT_IP"
echo ""
echo "   Opción 3 — Usar la IP directamente:"
echo "     https://$CURRENT_IP (aceptar certificado)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Listo. Ahora ejecuta:"
echo "   docker compose -f docker-compose.prod.yml up -d --build"
