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
echo "==> Esperando a que PostgreSQL esté listo y fuera de recovery..."
POSTGRES_READY=false
for i in $(seq 1 60); do
  if pg_isready -h postgres -p 5432 -U tickets_user -d tickets_db -q 2>/dev/null; then
    RECOVERY=""
    if [ -n "${DATABASE_URL:-}" ]; then
      RECOVERY=$(psql "${DATABASE_URL}" -tAc "SELECT pg_is_in_recovery()" 2>/dev/null | tr -d '[:space:]')
    fi
    if [ "$RECOVERY" = "f" ] || [ "$RECOVERY" = "false" ]; then
      echo "==> PostgreSQL listo y estable."
      POSTGRES_READY=true
      break
    fi
    echo "==> PostgreSQL en recovery mode (intento ${i}/60)..."
  else
    echo "==> Esperando PostgreSQL (intento ${i}/60)..."
  fi
  sleep 3
done

if [ "$POSTGRES_READY" != "true" ]; then
  echo "==> ADVERTENCIA: PostgreSQL no estabilizó — revisa logs de postgres y ejecuta docker/scripts/fix-pgbackrest.sh"
fi

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
  echo "==> Base de datos ya tiene usuarios — omitiendo seed completo."
fi

# Catálogos de inventario (tipos, marcas, bodegas) — siempre verificar al arrancar
echo "==> Verificando catálogos de inventario..."
CATALOG_CHECK=0
node - <<'NODESCRIPT' || CATALOG_CHECK=$?
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const [types, brands, warehouses, supplierTypes] = await Promise.all([
      p.equipment_types.count(),
      p.equipment_brands.count(),
      p.warehouses.count(),
      p.supplier_types.count(),
    ]);
    if (types === 0 || brands === 0 || warehouses === 0 || supplierTypes === 0) {
      console.log('  → Catálogos incompletos (tipos=' + types + ', marcas=' + brands + ', bodegas=' + warehouses + ', tipos proveedor=' + supplierTypes + ')');
      process.exit(2);
    }
    console.log('  → Catálogos OK (tipos=' + types + ', marcas=' + brands + ', bodegas=' + warehouses + ', tipos proveedor=' + supplierTypes + ')');
    process.exit(0);
  } catch (e) {
    console.error('  → Error verificando catálogos:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
NODESCRIPT

if [ "$CATALOG_CHECK" = "2" ]; then
  echo "==> Ejecutando ensure-catalogs..."
  if $TSX_CLI prisma/ensure-catalogs.ts; then
    echo "==> Catálogos de inventario restaurados."
  else
    echo "==> ADVERTENCIA: ensure-catalogs falló — ejecuta manualmente:"
    echo "==>   docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-catalogs.ts'"
  fi
elif [ "$CATALOG_CHECK" != "0" ]; then
  echo "==> ADVERTENCIA: No se pudo verificar catálogos (código $CATALOG_CHECK)"
fi

# Departamentos — si hay huérfanos (Sin familia) o la tabla está vacía, sincronizar
# familyId según organigrama (idempotente; no borra datos de usuario).
echo "==> Verificando departamentos y familias..."
DEPTS_CHECK=0
node - <<'NODESCRIPT' || DEPTS_CHECK=$?
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const total = await p.departments.count();
    const orphans = await p.departments.count({ where: { familyId: null } });
    if (total === 0 || orphans > 0) {
      console.log('  → Departamentos a sincronizar (total=' + total + ', sin familia=' + orphans + ')');
      process.exit(2);
    }
    console.log('  → Departamentos OK (' + total + ', todos con familia)');
    process.exit(0);
  } catch (e) {
    console.error('  → Error verificando departamentos:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
NODESCRIPT

if [ "$DEPTS_CHECK" = "2" ]; then
  echo "==> Ejecutando ensure-departments..."
  if $TSX_CLI prisma/ensure-departments.ts; then
    echo "==> Departamentos sincronizados con familias."
  else
    echo "==> ADVERTENCIA: ensure-departments falló — ejecuta manualmente:"
    echo "==>   docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-departments.ts'"
  fi
elif [ "$DEPTS_CHECK" != "0" ]; then
  echo "==> ADVERTENCIA: No se pudo verificar departamentos (código $DEPTS_CHECK)"
fi

# Categorías de tickets — si el seed completo se omitió (ya hay usuarios) pero
# categories quedó vacía, restaurarlas igual que ensure-catalogs.
echo "==> Verificando categorías de tickets..."
CATEGORIES_CHECK=0
node - <<'NODESCRIPT' || CATEGORIES_CHECK=$?
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const count = await p.categories.count();
    if (count === 0) {
      console.log('  → Categorías vacías (0)');
      process.exit(2);
    }
    console.log('  → Categorías OK (' + count + ')');
    process.exit(0);
  } catch (e) {
    console.error('  → Error verificando categorías:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
NODESCRIPT

if [ "$CATEGORIES_CHECK" = "2" ]; then
  echo "==> Ejecutando ensure-categories..."
  if $TSX_CLI prisma/ensure-categories.ts; then
    echo "==> Categorías de tickets restauradas."
  else
    echo "==> ADVERTENCIA: ensure-categories falló — ejecuta manualmente:"
    echo "==>   docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-categories.ts'"
  fi
elif [ "$CATEGORIES_CHECK" != "0" ]; then
  echo "==> ADVERTENCIA: No se pudo verificar categorías (código $CATEGORIES_CHECK)"
fi

# Verificar datos esenciales que podrían faltar (landing page services, etc.)
echo "==> Verificando datos esenciales de landing page..."
node - <<'NODESCRIPT' 2>/dev/null || true
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const servicesCount = await p.landing_page_services.count();
    if (servicesCount === 0) {
      console.log('  → landing_page_services vacía — insertando servicios por defecto...');
      const services = [
        { id: 'service-1', order: 1, enabled: true, icon: 'Wrench', iconColor: 'blue', title: 'Soporte TI', description: 'Atención de incidencias tecnológicas con seguimiento en tiempo real.' },
        { id: 'service-2', order: 2, enabled: true, icon: 'Server', iconColor: 'green', title: 'Gestión de Inventario', description: 'Control de equipos, asignaciones y actas de entrega digitales.' },
        { id: 'service-3', order: 3, enabled: true, icon: 'Building2', iconColor: 'orange', title: 'Infraestructura', description: 'Soporte para activos fijos, mantenimiento e infraestructura.' },
      ];
      for (const s of services) {
        await p.landing_page_services.create({ data: s });
      }
      console.log('  → Servicios de landing insertados.');
    }
    const contentCount = await p.landing_page_content.count();
    if (contentCount === 0) {
      console.log('  → landing_page_content vacía — insertando contenido por defecto...');
      await p.landing_page_content.create({
        data: {
          id: 'default',
          heroTitle: 'Soporte Multi-Área',
          heroSubtitle: 'Gestión de tickets para todas las áreas de tu organización',
          heroCtaPrimary: 'Crear Ticket de Soporte',
          heroCtaPrimaryUrl: '/login',
          heroCtaSecondary: 'Ver Servicios',
          heroCtaSecondaryUrl: '#servicios',
          servicesTitle: 'Nuestros Servicios',
          servicesSubtitle: 'Soporte técnico integral para todas las áreas',
          servicesEnabled: true,
          companyName: 'Sistema de Tickets',
          companyTagline: 'Gestión Integral de Operaciones',
          footerText: '© ' + new Date().getFullYear() + ' Sistema de Tickets. Todos los derechos reservados.',
        },
      });
      console.log('  → Contenido de landing insertado.');
    }
  } catch (e) {
    console.error('  → Error verificando landing:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
NODESCRIPT

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
