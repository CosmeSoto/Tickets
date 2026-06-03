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

# ── 1. Sincronizar schema de base de datos ───────────────────────────────────
echo "==> Sincronizando schema de base de datos..."
DB_PUSH_OK=false

# Intentar db push con reintentos (puede tardar si Postgres acaba de iniciar)
for attempt in 1 2 3; do
  if $PRISMA_CLI db push --accept-data-loss 2>&1; then
    DB_PUSH_OK=true
    break
  fi
  echo "==> db push intento ${attempt} falló — esperando 5s..."
  sleep 5
done

if [ "$DB_PUSH_OK" = "false" ]; then
  echo "==> db push falló — intentando migrate deploy como fallback..."
  $PRISMA_CLI migrate deploy 2>&1 || echo "==> migrate deploy también falló — continuando de todas formas"
fi
echo "==> Schema sincronizado (o advertencia ignorada)."

# ── 2. Seed inicial (solo si la tabla de usuarios está vacía) ─────────────────
# Usa node directamente para consultar la BD — más confiable que parsear prisma CLI.
echo "==> Verificando si la base de datos necesita seed..."

NEEDS_SEED=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.users.count().then(c => {
  console.log(c === 0 ? 'yes' : 'no');
  return p.\$disconnect();
}).catch(() => {
  console.log('yes');
  process.exit(0);
});
" 2>/dev/null || echo "yes")

if [ "$NEEDS_SEED" = "yes" ]; then
  echo "==> Base de datos vacía — ejecutando seed inicial..."
  $TSX_CLI prisma/seed.ts
  echo "==> Seed completado."
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
