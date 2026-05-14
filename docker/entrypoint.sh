#!/bin/sh
set -e

# Imagen standalone: no hay `prisma` en PATH ni npx resuelve el CLI.
PRISMA_CLI='node ./node_modules/prisma/build/index.js'
TSX_CLI='node ./node_modules/tsx/dist/cli.mjs'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Sistema de Tickets — Iniciando..."
echo "  NODE_ENV: ${NODE_ENV}"
echo "  NEXTAUTH_URL: ${NEXTAUTH_URL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Migraciones de base de datos ──────────────────────────────────────────
# migrate deploy aplica solo las migraciones pendientes — idempotente y seguro.
echo "==> Ejecutando migraciones..."
$PRISMA_CLI migrate deploy
echo "==> Migraciones completadas."

# ── 2. Seed inicial (solo si la tabla de usuarios está vacía) ─────────────────
# Evita re-seedear en cada reinicio del contenedor.
USER_COUNT=$($PRISMA_CLI db execute --stdin <<'SQL' 2>/dev/null || echo "0"
SELECT COUNT(*)::text FROM users;
SQL
)
USER_COUNT=$(echo "$USER_COUNT" | tr -d '[:space:]' | tail -1)

if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "==> Base de datos vacía — ejecutando seed inicial..."
  $TSX_CLI prisma/seed.ts
  echo "==> Seed completado."
else
  echo "==> Base de datos ya tiene datos (${USER_COUNT} usuarios) — omitiendo seed."
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

# ── 4. Arrancar Next.js ───────────────────────────────────────────────────────
echo "==> Iniciando servidor Next.js..."
exec node server.js
