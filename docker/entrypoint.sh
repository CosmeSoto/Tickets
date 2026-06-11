#!/bin/sh
set -e

# Imagen standalone: no hay `prisma` en PATH ni npx resuelve el CLI.
PRISMA_CLI='node ./node_modules/prisma/build/index.js'
TSX_CLI='node ./node_modules/tsx/dist/cli.mjs'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Sistema de Gestión — Iniciando..."
echo "  NODE_ENV: ${NODE_ENV}"
echo "  NEXTAUTH_URL: ${NEXTAUTH_URL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 0. Arreglar permisos de volúmenes montados ───────────────────────────────
# Los volúmenes Docker se crean como root; asegurar que nextjs pueda escribir.
UPLOADS_DIR="${UPLOAD_DIR:-/app/public/uploads}"
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
LOGS_DIR="/app/logs"

mkdir -p "$UPLOADS_DIR" "$BACKUP_DIR" "$LOGS_DIR"
chown -R nextjs:nodejs "$UPLOADS_DIR" "$BACKUP_DIR" "$LOGS_DIR" 2>/dev/null || true

# ── 0b. Pre-migración: limpiar bodegas sin familia antes del db push ─────────
# Las bodegas deben pertenecer siempre a una familia (family_id NOT NULL).
# Si existen registros con family_id = NULL de versiones anteriores,
# el db push fallaría al intentar SET NOT NULL.
# El script vive en un archivo JS separado para evitar cualquier conflicto
# con la interpolación de variables de bash dentro de código JS.
echo "==> Verificando bodegas huérfanas (sin familia)..."
node ./docker/fix-orphan-warehouses.js || true

# ── 1. Sincronizar schema de base de datos ───────────────────────────────────
echo "==> Esperando a que PostgreSQL esté listo..."
# pg_isready es más fiable que confiar solo en el healthcheck de Compose
for i in $(seq 1 30); do
  if pg_isready -h postgres -p 5432 -U tickets_user -d tickets_db -q 2>/dev/null; then
    echo "==> PostgreSQL listo."
    break
  fi
  echo "==> Esperando PostgreSQL (intento ${i}/30)..."
  sleep 2
done

echo "==> Sincronizando schema de base de datos..."
DB_PUSH_OK=false

# Intentar db push con reintentos (puede tardar si Postgres acaba de iniciar)
for attempt in 1 2 3 4 5; do
  if $PRISMA_CLI db push --accept-data-loss 2>&1; then
    DB_PUSH_OK=true
    break
  fi
  echo "==> db push intento ${attempt} falló — esperando 8s..."
  sleep 8
done

if [ "$DB_PUSH_OK" = "true" ]; then
  # Marcar la migración de incidentes como aplicada si existe (puede que ya
  # esté aplicada desde un deploy anterior; el || true evita error duplicado).
  $PRISMA_CLI migrate resolve --applied 20260604000000_add_patrol_incidents 2>/dev/null || true
  echo "==> Schema sincronizado."
else
  echo "==> db push falló — intentando migrate deploy como fallback..."
  if $PRISMA_CLI migrate deploy 2>&1; then
    echo "==> migrate deploy completado."
  else
    echo "==> ADVERTENCIA: No se pudo sincronizar el schema — el servidor arrancará de todas formas."
    echo "==>   Revisa los logs de postgres y re-ejecuta: docker restart tickets-app"
  fi
fi

# ── 2. Seed inicial (solo si la tabla de usuarios está vacía) ─────────────────
echo "==> Verificando si la base de datos necesita seed..."

# Heredoc con comillas (<<'NODESCRIPT') evita que bash expanda variables JS.
NEEDS_SEED=$(node - <<'NODESCRIPT' 2>/dev/null || echo "yes"
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.users.count().then(c => {
  console.log(c === 0 ? 'yes' : 'no');
  return p.$disconnect();
}).catch(() => {
  console.log('yes');
  process.exit(0);
});
NODESCRIPT
)

if [ "$NEEDS_SEED" = "yes" ]; then
  echo "==> Base de datos vacía — ejecutando seed inicial..."
  # No dejar que un fallo del seed mate el container (set -e está activo).
  # Si el seed falla, el servidor arranca igual y el admin puede re-ejecutarlo.
  if $TSX_CLI prisma/seed.ts; then
    echo "==> Seed completado."
  else
    echo "==> ADVERTENCIA: Seed falló — el servidor arrancará de todas formas."
    echo "==>   Para re-ejecutar el seed: docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts'"
  fi
else
  echo "==> Base de datos ya tiene datos — omitiendo seed."
fi

# ── 3. Copiar uploads iniciales si el volumen está vacío ─────────────────────
UPLOADS_DIR="${UPLOAD_DIR:-/app/public/uploads}"
if [ -d "/app/public/uploads" ] && [ "$UPLOADS_DIR" != "/app/public/uploads" ]; then
  if [ ! -d "$UPLOADS_DIR" ] || [ -z "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    echo "==> Copiando uploads iniciales a $UPLOADS_DIR..."
    mkdir -p "$UPLOADS_DIR"
    cp -rn /app/public/uploads/. "$UPLOADS_DIR/" 2>/dev/null || true
    echo "==> Uploads copiados."
  fi
fi

# ── 4. Arrancar Next.js como usuario nextjs ──────────────────────────────────
echo "==> Iniciando servidor Next.js..."
exec su-exec nextjs node server.js
