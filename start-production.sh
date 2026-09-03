#!/bin/bash
##############################################################################
# start-production.sh
#
# Script único para levantar el sistema en producción local.
# Detecta la IP actual, actualiza DNS, regenera certificados si es necesario,
# y levanta todos los servicios con docker compose.
#
# Uso:
#   sudo ./start-production.sh                 # rebuild (conserva BD); entrypoint sincroniza organigrama
#   sudo ./start-production.sh --clean         # borra volúmenes + seed completo desde cero (~3–6 min)
#   sudo ./start-production.sh --clear         # alias de --clean
#   sudo ./start-production.sh --clean --no-cache  # rebuild total sin caché (solo si hay problemas de imagen)
#
# Seed vs organigrama:
#   - Sin --clean: NO re-ejecuta seed completo (hay usuarios); SÍ corre ensure-departments
#     (TI, Telefonía, etc.) en cada arranque — idempotente, no borra datos.
#   - Con --clean: borra BD → seed completo + ensures.
#   - Dev desde cero: ./docker/scripts/reset-dev-from-scratch.sh (down -v + ensure-departments)
#
# Requisitos:
#   - Docker y Docker Compose instalados
#   - mkcert instalado (brew install mkcert) para certificados SSL locales
#   - Ejecutar con sudo (necesario para /etc/hosts)
##############################################################################

set -e

# ── Parámetros ─────────────────────────────────────────────────────────────────
CLEAN_BUILD=false
NO_CACHE=false
for arg in "$@"; do
  case "$arg" in
    --clean|--clear) CLEAN_BUILD=true ;;
    --no-cache) NO_CACHE=true ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="gestion.local"
DOMAIN_WWW="www.gestion.local"
HOSTS_FILE="/etc/hosts"
MARKER="# gestion-local-auto"
CERTS_DIR="$SCRIPT_DIR/docker/certs"
ENV_FILE="$SCRIPT_DIR/.env.production"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Sistema de Gestión — Inicio de Producción Local      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Detectar IP actual ──────────────────────────────────────────────────────
get_local_ip() {
  # macOS: route + ifconfig
  if [ "$(uname)" = "Darwin" ]; then
    local iface
    iface=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
    if [ -n "$iface" ]; then
      local ip
      ip=$(ifconfig "$iface" 2>/dev/null | awk '/inet /{print $2}' | head -1)
      if [ -n "$ip" ]; then
        echo "$ip"
        return
      fi
    fi
  fi
  # Linux: ip route
  if command -v ip &>/dev/null; then
    local ip
    ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -1)
    if [ -n "$ip" ]; then
      echo "$ip"
      return
    fi
  fi
  # Fallback genérico: hostname -I
  hostname -I 2>/dev/null | awk '{print $1}' || echo ""
}

CURRENT_IP=$(get_local_ip)

if [ -z "$CURRENT_IP" ]; then
  echo "❌ No se pudo detectar la IP de red local."
  exit 1
fi

echo "🌐 IP detectada: $CURRENT_IP"

# ── 2. Actualizar /etc/hosts ───────────────────────────────────────────────────
if grep -q "$MARKER" "$HOSTS_FILE" 2>/dev/null; then
  sed -i.tmp "/$MARKER/d" "$HOSTS_FILE" && rm -f "${HOSTS_FILE}.tmp"
fi
# Eliminar cualquier otra entrada de gestion.local
sed -i.tmp "/$DOMAIN/d" "$HOSTS_FILE" && rm -f "${HOSTS_FILE}.tmp"

echo "$CURRENT_IP    $DOMAIN $DOMAIN_WWW $MARKER" >> "$HOSTS_FILE"
echo "✅ /etc/hosts → $CURRENT_IP $DOMAIN"

# Flush DNS
if command -v dscacheutil &>/dev/null; then
  dscacheutil -flushcache
  killall -HUP mDNSResponder 2>/dev/null || true
elif command -v resolvectl &>/dev/null; then
  resolvectl flush-caches 2>/dev/null || true
elif command -v systemd-resolve &>/dev/null; then
  systemd-resolve --flush-caches 2>/dev/null || true
fi

# ── 3. Actualizar NEXTAUTH_URL en .env.production ─────────────────────────────
ensure_backup_env() {
  if [ ! -f "$ENV_FILE" ]; then
    return
  fi
  local changed=false

  local current_secret
  current_secret=$(grep "^BACKUP_WORKER_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
  if [ -z "$current_secret" ]; then
    local secret
    secret=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
    if grep -q "^BACKUP_WORKER_SECRET=" "$ENV_FILE"; then
      sed -i.tmp "s|^BACKUP_WORKER_SECRET=.*|BACKUP_WORKER_SECRET=$secret|" "$ENV_FILE" && rm -f "${ENV_FILE}.tmp"
    else
      echo "BACKUP_WORKER_SECRET=$secret" >> "$ENV_FILE"
    fi
    echo "✅ BACKUP_WORKER_SECRET generado en .env.production"
    changed=true
  fi

  local current_worker_url
  current_worker_url=$(grep "^BACKUP_WORKER_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
  if [ -z "$current_worker_url" ]; then
    if grep -q "^BACKUP_WORKER_URL=" "$ENV_FILE"; then
      sed -i.tmp "s|^BACKUP_WORKER_URL=.*|BACKUP_WORKER_URL=http://backup-worker:8080|" "$ENV_FILE" && rm -f "${ENV_FILE}.tmp"
    else
      echo "BACKUP_WORKER_URL=http://backup-worker:8080" >> "$ENV_FILE"
    fi
    changed=true
  fi

  local current_stanza
  current_stanza=$(grep "^PGBACKREST_STANZA=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
  if [ -z "$current_stanza" ]; then
    if grep -q "^PGBACKREST_STANZA=" "$ENV_FILE"; then
      sed -i.tmp "s|^PGBACKREST_STANZA=.*|PGBACKREST_STANZA=main|" "$ENV_FILE" && rm -f "${ENV_FILE}.tmp"
    else
      echo "PGBACKREST_STANZA=main" >> "$ENV_FILE"
    fi
    changed=true
  fi

  local current_allow_restore
  current_allow_restore=$(grep "^BACKUP_ALLOW_RESTORE=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
  if [ -z "$current_allow_restore" ]; then
    if grep -q "^BACKUP_ALLOW_RESTORE=" "$ENV_FILE"; then
      sed -i.tmp "s|^BACKUP_ALLOW_RESTORE=.*|BACKUP_ALLOW_RESTORE=false|" "$ENV_FILE" && rm -f "${ENV_FILE}.tmp"
    else
      echo "BACKUP_ALLOW_RESTORE=false" >> "$ENV_FILE"
    fi
    changed=true
  fi

  local current_cron_secret
  current_cron_secret=$(grep "^CRON_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
  if [ -z "$current_cron_secret" ]; then
    local cron_secret
    cron_secret=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
    if grep -q "^CRON_SECRET=" "$ENV_FILE"; then
      sed -i.tmp "s|^CRON_SECRET=.*|CRON_SECRET=$cron_secret|" "$ENV_FILE" && rm -f "${ENV_FILE}.tmp"
    else
      echo "CRON_SECRET=$cron_secret" >> "$ENV_FILE"
    fi
    echo "✅ CRON_SECRET generado — instala cron: ./docker/scripts/setup-backup-cron.sh"
    changed=true
  fi

  local target_docker_gid="999"
  if [ "$(uname)" = "Darwin" ]; then
    target_docker_gid="1"
  elif command -v getent &>/dev/null; then
    local detected_gid
    detected_gid=$(getent group docker 2>/dev/null | cut -d: -f3 || true)
    if [ -n "$detected_gid" ] && [[ "$detected_gid" =~ ^[0-9]+$ ]]; then
      target_docker_gid="$detected_gid"
    fi
  elif [ -e "/var/run/docker.sock" ]; then
    local detected_gid
    detected_gid=$(stat -c "%g" /var/run/docker.sock 2>/dev/null || true)
    if [ -n "$detected_gid" ] && [[ "$detected_gid" =~ ^[0-9]+$ ]]; then
      target_docker_gid="$detected_gid"
    fi
  fi

  local current_docker_gid
  current_docker_gid=$(grep "^DOCKER_GID=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
  if [ "$current_docker_gid" != "$target_docker_gid" ]; then
    if grep -q "^DOCKER_GID=" "$ENV_FILE"; then
      sed -i.tmp "s|^DOCKER_GID=.*|DOCKER_GID=$target_docker_gid|" "$ENV_FILE" && rm -f "${ENV_FILE}.tmp"
    else
      echo "DOCKER_GID=$target_docker_gid" >> "$ENV_FILE"
    fi
    echo "✅ DOCKER_GID=$target_docker_gid (restauración pgBackRest desde UI)"
    changed=true
  fi

  if [ "$changed" = true ]; then
    echo "✅ Variables pgBackRest verificadas en .env.production"
  fi
}

# Usamos la IP directa para que funcione sin necesidad de configurar /etc/hosts
# en cada cliente. Si en el futuro se quiere usar dominio, cambiar NEXTAUTH_URL
# manualmente a https://gestion.local y asegurarse de que los clientes tengan
# el dominio en su /etc/hosts.
if [ -f "$ENV_FILE" ]; then
  if grep -q "^NEXTAUTH_URL=" "$ENV_FILE"; then
    sed -i.tmp "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://$CURRENT_IP|" "$ENV_FILE" && rm -f "${ENV_FILE}.tmp"
  else
    echo "NEXTAUTH_URL=https://$CURRENT_IP" >> "$ENV_FILE"
  fi
  # Actualizar CORS_ORIGINS si existe
  if grep -q "^CORS_ORIGINS=" "$ENV_FILE"; then
    sed -i.tmp "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://$CURRENT_IP|" "$ENV_FILE" && rm -f "${ENV_FILE}.tmp"
  fi
  echo "✅ NEXTAUTH_URL=https://$CURRENT_IP"
else
  echo "⚠️  No se encontró $ENV_FILE — crea uno desde .env.example"
fi

ensure_backup_env

# También actualizar .env.local.production si existe (legacy)
ENV_LOCAL_PROD="$SCRIPT_DIR/.env.local.production"
if [ -f "$ENV_LOCAL_PROD" ]; then
  sed -i.tmp "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://$DOMAIN|" "$ENV_LOCAL_PROD" && rm -f "${ENV_LOCAL_PROD}.tmp"
  if grep -q "^CORS_ORIGINS=" "$ENV_LOCAL_PROD"; then
    sed -i.tmp "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://$DOMAIN,https://$CURRENT_IP|" "$ENV_LOCAL_PROD" && rm -f "${ENV_LOCAL_PROD}.tmp"
  fi
  # Actualizar el comentario de IP
  sed -i.tmp "s|# PRODUCCIÓN RED LOCAL - IP:.*|# PRODUCCIÓN RED LOCAL - IP: $CURRENT_IP|" "$ENV_LOCAL_PROD" && rm -f "${ENV_LOCAL_PROD}.tmp"
  echo "✅ .env.local.production actualizado con IP $CURRENT_IP"
fi

# ── 4. Verificar certificados SSL ─────────────────────────────────────────────
if [ ! -f "$CERTS_DIR/$DOMAIN.pem" ] || [ ! -f "$CERTS_DIR/$DOMAIN-key.pem" ]; then
  echo "🔐 Generando certificados SSL con mkcert..."
  if command -v mkcert &>/dev/null; then
    mkdir -p "$CERTS_DIR"
    mkcert -install 2>/dev/null || true
    mkcert -cert-file "$CERTS_DIR/$DOMAIN.pem" \
           -key-file "$CERTS_DIR/$DOMAIN-key.pem" \
           "$DOMAIN" "$DOMAIN_WWW" "$CURRENT_IP" localhost 127.0.0.1
    echo "✅ Certificados generados (incluye IP $CURRENT_IP como SAN)"
  else
    echo "⚠️  mkcert no instalado. Instala con: brew install mkcert"
    echo "   Los certificados existentes se usarán si están disponibles."
  fi
else
  echo "✅ Certificados SSL existentes en $CERTS_DIR"
  # Verificar si la IP actual está en el certificado
  if command -v openssl &>/dev/null; then
    CERT_SANS=$(openssl x509 -in "$CERTS_DIR/$DOMAIN.pem" -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | tail -1)
    if ! echo "$CERT_SANS" | grep -q "$CURRENT_IP"; then
      echo "⚠️  La IP $CURRENT_IP no está en el certificado actual."
      echo "   Regenerando certificados..."
      if command -v mkcert &>/dev/null; then
        mkcert -cert-file "$CERTS_DIR/$DOMAIN.pem" \
               -key-file "$CERTS_DIR/$DOMAIN-key.pem" \
               "$DOMAIN" "$DOMAIN_WWW" "$CURRENT_IP" localhost 127.0.0.1
        echo "✅ Certificados regenerados con IP $CURRENT_IP"
      fi
    fi
  fi
fi

# ── 5. Levantar servicios ─────────────────────────────────────────────────────
echo ""

# ── 4b. Verificar DNS de Docker (solo en Linux) ──────────────────────────────
if [ "$(uname)" = "Linux" ]; then
  DOCKER_DAEMON_JSON="/etc/docker/daemon.json"
  NEEDS_DOCKER_RESTART=false

  mkdir -p /etc/docker

  if [ ! -f "$DOCKER_DAEMON_JSON" ]; then
    echo "⚙️  Configurando DNS de Docker (primera vez)..."
    cat > "$DOCKER_DAEMON_JSON" <<'EOF'
{
  "dns": ["8.8.8.8", "8.8.4.4", "1.1.1.1"]
}
EOF
    NEEDS_DOCKER_RESTART=true
    echo "✅ DNS de Docker configurado (8.8.8.8, 8.8.4.4, 1.1.1.1)"
  elif ! grep -q '"dns"' "$DOCKER_DAEMON_JSON"; then
    echo "⚙️  Agregando DNS a configuración existente de Docker..."
    # Insertar dns antes del último }
    sed -i.tmp 's/}$/,\n  "dns": ["8.8.8.8", "8.8.4.4", "1.1.1.1"]\n}/' "$DOCKER_DAEMON_JSON" && rm -f "${DOCKER_DAEMON_JSON}.tmp"
    NEEDS_DOCKER_RESTART=true
    echo "✅ DNS de Docker actualizado"
  fi

  if [ "$NEEDS_DOCKER_RESTART" = true ]; then
    echo "🔄 Reiniciando Docker daemon para aplicar DNS..."
    if command -v systemctl &>/dev/null; then
      systemctl restart docker
    elif command -v service &>/dev/null; then
      service docker restart
    fi
    sleep 3
    echo "✅ Docker daemon reiniciado"
  fi
fi

echo "🐳 Levantando servicios con Docker Compose..."
echo ""

COMPOSE=(docker compose --env-file "$SCRIPT_DIR/.env.production" -f "$SCRIPT_DIR/docker-compose.prod.yml")
SERVICES=(postgres backup-worker app)

if [ "$CLEAN_BUILD" = true ]; then
  echo "🧹 Modo --clean: deteniendo servicios y borrando volúmenes (BD + pgBackRest)..."
  "${COMPOSE[@]}" down -v --remove-orphans 2>/dev/null || true
fi

if [ "$NO_CACHE" = true ]; then
  echo "🔨 Rebuild sin caché (postgres, backup-worker, app)..."
  "${COMPOSE[@]}" build --no-cache "${SERVICES[@]}"
else
  echo "🔨 Rebuild con caché (postgres, backup-worker, app)..."
  "${COMPOSE[@]}" build "${SERVICES[@]}"
fi

"${COMPOSE[@]}" up -d postgres redis

wait_for_healthy() {
  local service="$1"
  local max_attempts="${2:-120}"
  local label="${3:-$service}"
  for i in $(seq 1 "$max_attempts"); do
    if "${COMPOSE[@]}" ps "$service" 2>/dev/null | grep -q "(healthy)"; then
      echo "✅ $label listo"
      return 0
    fi
    if [ $((i % 12)) -eq 0 ]; then
      echo "   … esperando $label ($i/$max_attempts)"
    fi
    sleep 5
  done
  return 1
}

echo ""
echo "⏳ Esperando PostgreSQL..."
if ! wait_for_healthy postgres 60 "PostgreSQL"; then
  echo "❌ PostgreSQL no alcanzó estado healthy"
  exit 1
fi

# pgBackRest listo = marcador + archive_mode=on (evita reinicio de PG a mitad del seed)
pgbackrest_ready() {
  "${COMPOSE[@]}" exec -T postgres test -f /var/lib/pgbackrest/.bootstrap_done 2>/dev/null || return 1
  local mode
  mode=$("${COMPOSE[@]}" exec -T postgres psql -U tickets_user -d tickets_db -tAc \
    "SHOW archive_mode" 2>/dev/null | tr -d '[:space:]')
  [ "$mode" = "on" ]
}

wait_for_pgbackrest_ready() {
  local max_attempts="${1:-180}"
  local label="${2:-pgBackRest}"
  for i in $(seq 1 "$max_attempts"); do
    if pgbackrest_ready; then
      echo "✅ $label listo (archive_mode=on)"
      return 0
    fi
    if [ $((i % 12)) -eq 0 ]; then
      echo "   … esperando $label — stanza/FULL/reinicio PG ($i/$max_attempts)"
    fi
    sleep 5
  done
  return 1
}

# Bootstrap lo hace backup-worker (una sola ruta).
# NO envolver init-pgbackrest.sh con `timeout`: timeout + docker compose exec se cuelga
# hasta el límite y sale 124 (bug conocido de Docker) — eso alargaba --clean ~30 min.
PG_OK=false
NEEDS_PGBR_INIT=false
if [ "$CLEAN_BUILD" = true ]; then
  echo "⚙️  Arranque limpio — bootstrap pgBackRest vía backup-worker..."
  NEEDS_PGBR_INIT=true
elif ! pgbackrest_ready; then
  NEEDS_PGBR_INIT=true
  echo "⚙️  pgBackRest pendiente — bootstrap vía backup-worker antes de la app..."
else
  PG_OK=true
  echo "✅ pgBackRest ya configurado"
fi

# Levantar backup-worker ANTES de la app: stanza + FULL + archive_mode sin matar el seed
echo ""
echo "🐳 Levantando backup-worker..."
"${COMPOSE[@]}" up -d backup-worker

if [ "$NEEDS_PGBR_INIT" = true ] || ! pgbackrest_ready; then
  echo "⏳ Esperando pgBackRest (stanza + FULL + reinicio PG, ~1–3 min)..."
  if wait_for_pgbackrest_ready 180 "pgBackRest"; then
    PG_OK=true
  else
    echo "⚠️  pgBackRest no terminó a tiempo — la app arrancará igual"
    echo "   Repara con: ./docker/scripts/fix-pgbackrest.sh"
    echo "   O en UI: Admin → Backups → Config → Inicializar"
  fi
  # Reinicio por archive_mode puede haber ocurrido durante la espera
  wait_for_healthy postgres 60 "PostgreSQL" || true
fi

echo ""
echo "🐳 Levantando app y nginx..."
"${COMPOSE[@]}" up -d app nginx

echo ""
echo "⏳ Esperando app (seed/migraciones ~1–2 min)..."
wait_for_healthy app 72 "app" || echo "⚠️  App aún iniciando — revisa logs si no responde en 3 min"

if [ "$PG_OK" = true ]; then
  echo "ℹ️  pgBackRest operativo — backups en Admin → Sistema de Backups"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ Sistema Iniciado                       ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  🌐 URL:  https://$CURRENT_IP                       ║"
echo "║                                                              ║"
echo "║  Accede desde cualquier equipo de la red con esa URL.        ║"
echo "║                                                              ║"
echo "║  📦 Backups: Admin → Sistema de Backups (/admin/backups)   ║"
echo "║     · Bootstrap pgBackRest termina ANTES del seed          ║"
echo "║     · Si falla: ./docker/scripts/fix-pgbackrest.sh         ║"
echo "║     · Respaldo pgBackRest = infraestructura (DR)             ║"
echo "║     · Exportar .dump = archivo portable                      ║"
echo "║     · Monitoreo = pestaña pgBackRest                         ║"
echo "║                                                              ║"
echo "║  Opcional — usar dominio amigable (requiere /etc/hosts):     ║"
echo "║    $CURRENT_IP    $DOMAIN $DOMAIN_WWW    ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
