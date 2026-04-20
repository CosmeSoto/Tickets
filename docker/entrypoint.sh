#!/bin/sh
set -e

echo "==> Iniciando aplicación..."

# ── Ejecutar migraciones de base de datos ─────────────────────────────────────
echo "==> Ejecutando migraciones de base de datos..."
npx prisma migrate deploy
echo "==> Migraciones completadas."

# ── Inicializar uploads desde public/uploads si el volumen está vacío ─────────
UPLOADS_DIR="${UPLOAD_DIR:-/app/public/uploads}"
SEED_DIR="/app/public/uploads"

if [ -d "$SEED_DIR" ] && [ "$UPLOADS_DIR" != "$SEED_DIR" ]; then
  if [ ! -d "$UPLOADS_DIR" ] || [ -z "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    echo "==> Copiando uploads iniciales a $UPLOADS_DIR..."
    mkdir -p "$UPLOADS_DIR"
    cp -rn "$SEED_DIR/." "$UPLOADS_DIR/" 2>/dev/null || true
    echo "==> Uploads iniciales copiados."
  fi
fi

exec node server.js
