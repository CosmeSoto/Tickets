#!/bin/sh
set -e

echo "==> Iniciando aplicación..."

# ── Inicializar uploads desde public/uploads si el volumen está vacío ─────────
# Esto garantiza que logos y archivos pre-existentes estén disponibles
# incluso en el primer arranque con un volumen nuevo.
UPLOADS_DIR="${UPLOAD_DIR:-/app/public/uploads}"
SEED_DIR="/app/public/uploads"

if [ -d "$SEED_DIR" ] && [ "$UPLOADS_DIR" != "$SEED_DIR" ]; then
  # Solo copiar si el destino está vacío o no existe
  if [ ! -d "$UPLOADS_DIR" ] || [ -z "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    echo "==> Copiando uploads iniciales a $UPLOADS_DIR..."
    mkdir -p "$UPLOADS_DIR"
    cp -rn "$SEED_DIR/." "$UPLOADS_DIR/" 2>/dev/null || true
    echo "==> Uploads iniciales copiados."
  fi
fi

exec node server.js
