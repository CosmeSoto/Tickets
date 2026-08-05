#!/bin/sh
set -e

echo "==> [dev] Esperando PostgreSQL listo y fuera de recovery..."
POSTGRES_READY=false
for i in $(seq 1 90); do
  if pg_isready -h postgres -p 5432 -U tickets_user -d tickets_db -q 2>/dev/null; then
    RECOVERY=""
    if [ -n "${DATABASE_URL:-}" ]; then
      RECOVERY=$(psql "${DATABASE_URL}" -tAc "SELECT pg_is_in_recovery()" 2>/dev/null | tr -d '[:space:]')
    fi
    if [ "$RECOVERY" = "f" ] || [ "$RECOVERY" = "false" ]; then
      echo "==> [dev] PostgreSQL listo (lectura/escritura)."
      POSTGRES_READY=true
      break
    fi
    echo "==> [dev] PostgreSQL en recovery — esperando ($i/90)..."
  else
    echo "==> [dev] Esperando PostgreSQL ($i/90)..."
  fi
  sleep 3
done

if [ "$POSTGRES_READY" != "true" ]; then
  echo "==> ADVERTENCIA: PostgreSQL no salió de recovery — la app puede fallar al escribir."
  echo "==>   Promover manualmente: docker exec -u postgres tickets-postgres-dev pg_ctl promote -D /var/lib/postgresql/data"
fi

echo "==> [dev] Sincronizando schema..."
if npx prisma db push --accept-data-loss; then
  # Mismo criterio que producción: schema.prisma es la fuente de verdad;
  # alinear _prisma_migrations para portabilidad entre equipos/servidores.
  if [ -d ./prisma/migrations ]; then
    echo "==> [dev] Alineando historial de migraciones Prisma..."
    for mig_dir in ./prisma/migrations/*/; do
      [ -d "$mig_dir" ] || continue
      mig_name=$(basename "$mig_dir")
      npx prisma migrate resolve --applied "$mig_name" 2>/dev/null || true
    done
  fi
else
  echo "==> ADVERTENCIA: db push falló — intentando migrate deploy..."
  npx prisma migrate deploy || echo "==> ADVERTENCIA: migrate deploy también falló"
fi

echo "==> [dev] Verificando seed..."
NEEDS_SEED=$(node - <<'NODESCRIPT' 2>/dev/null || echo "no"
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.users.count().then(c => {
  console.log(c === 0 ? 'yes' : 'no');
  return p.$disconnect();
}).catch(() => {
  console.log('no');
  process.exit(0);
});
NODESCRIPT
)

if [ "$NEEDS_SEED" = "yes" ]; then
  echo "==> [dev] Base de datos vacía — ejecutando seed..."
  npm run db:seed || echo "==> ADVERTENCIA: seed falló — el servidor arrancará de todas formas"
else
  echo "==> [dev] Base de datos con datos — omitiendo seed completo."
fi

# Organigrama idempotente (TI/Telefonía/etc.) aunque el seed se haya omitido
echo "==> [dev] Sincronizando departamentos (ensure-departments)..."
npx tsx prisma/ensure-departments.ts || \
  node ./node_modules/tsx/dist/cli.mjs prisma/ensure-departments.ts || \
  echo "==> ADVERTENCIA: ensure-departments falló — npm run db:seed-departments"

echo "==> [dev] Iniciando Next.js (webpack)..."
exec npm run dev:docker
