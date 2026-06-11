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
# Las bodegas deben pertenecer siempre a una familia (family_id NOT NULL desde
# schema actual). Si existen registros con family_id = NULL de versiones anteriores,
# el db push fallaría al intentar SET NOT NULL. Este bloque los elimina primero
# solo si no tienen ítems asignados; si los tienen, los marca como inactivos para
# evitar pérdida de datos y permite que el operador los reasigne manualmente.
echo "==> Verificando bodegas huérfanas (sin familia)..."
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function fixOrphans() {
  let fixed = 0, warned = 0;
  try {
    // Solo actúa si la columna family_id acepta NULL todavía
    const orphans = await p.\$queryRaw\`
      SELECT w.id, w.name,
        (SELECT COUNT(*) FROM equipment WHERE warehouse_id = w.id) +
        (SELECT COUNT(*) FROM consumables WHERE warehouse_id = w.id) +
        (SELECT COUNT(*) FROM equipment_batches WHERE warehouse_id = w.id) AS total_items
      FROM warehouses w
      WHERE w.family_id IS NULL
    \`;
    for (const row of orphans) {
      if (Number(row.total_items) === 0) {
        await p.\$executeRaw\`DELETE FROM warehouses WHERE id = ${row.id}\`;
        console.log('  Eliminada bodega huérfana sin ítems: ' + row.name);
        fixed++;
      } else {
        await p.\$executeRaw\`UPDATE warehouses SET is_active = false WHERE id = ${row.id}\`;
        console.warn('  ADVERTENCIA: bodega huérfana con ítems desactivada: ' + row.name + ' — asignar familia manualmente');
        warned++;
      }
    }
    if (fixed === 0 && warned === 0) console.log('  No hay bodegas huérfanas.');
  } catch (e) {
    // Si family_id ya es NOT NULL o la tabla no existe aún, ignorar
    if (!e.message.includes('null') && !e.message.includes('does not exist')) {
      console.log('  Pre-check bodegas: ' + e.message);
    }
  } finally {
    await p.\$disconnect();
  }
}
fixOrphans();
" 2>/dev/null || true

# ── 1. Sincronizar schema de base de datos ───────────────────────────────────
echo "==> Sincronizando schema de base de datos..."
DB_PUSH_OK=false

# Estrategia: db push para garantizar que el schema esté completo (crea columnas
# faltantes que no tienen migración formal). Luego migrate deploy para marcar
# las migraciones como aplicadas (evita re-ejecución en futuros deploys).
for attempt in 1 2 3; do
  if $PRISMA_CLI db push --accept-data-loss 2>&1; then
    DB_PUSH_OK=true
    break
  fi
  echo "==> db push intento ${attempt} falló — esperando 5s..."
  sleep 5
done

if [ "$DB_PUSH_OK" = "true" ]; then
  # Marcar migraciones como aplicadas (si la tabla existe)
  $PRISMA_CLI migrate resolve --applied 20260604000000_add_patrol_incidents 2>/dev/null || true
else
  echo "==> ERROR FATAL: No se pudo sincronizar la base de datos"
  exit 1
fi
echo "==> Schema sincronizado."

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
