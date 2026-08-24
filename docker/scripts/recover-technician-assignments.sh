#!/usr/bin/env bash
# ============================================================
# recover-technician-assignments.sh
#
# Recupera las asignaciones de técnicos a categorías (tabla
# technician_assignments) desde el backup .dump de pgdump
# que tengas disponible.
#
# Uso en el servidor de producción:
#   chmod +x docker/scripts/recover-technician-assignments.sh
#   ./docker/scripts/recover-technician-assignments.sh
#
# Si el dump está en otra ruta, pásala como primer argumento:
#   ./docker/scripts/recover-technician-assignments.sh /ruta/al/backup.dump
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Configuración ─────────────────────────────────────────────
# Primer argumento opcional: ruta al .dump
DUMP_FILE="${1:-}"

# Si no se pasó argumento, buscar el dump más reciente en backups/
if [[ -z "$DUMP_FILE" ]]; then
  DUMP_FILE=$(ls -t "$PROJECT_ROOT/backups/"*.dump 2>/dev/null | head -1 || true)
fi

if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "❌ No se encontró ningún archivo .dump en $PROJECT_ROOT/backups/"
  echo "   Pasa la ruta como argumento: $0 /ruta/al/backup.dump"
  exit 1
fi

echo "📦 Usando dump: $DUMP_FILE"

# ── Leer DATABASE_URL ─────────────────────────────────────────
ENV_FILE="$PROJECT_ROOT/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="$PROJECT_ROOT/.env"
fi

DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
if [[ -z "$DB_URL" ]]; then
  echo "❌ No se encontró DATABASE_URL en $ENV_FILE"
  exit 1
fi

# Parsear URL: postgresql://user:pass@host:port/db
DB_USER=$(echo "$DB_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')

echo "🔌 Conectando a $DB_HOST:$DB_PORT/$DB_NAME como $DB_USER"

# ── Paso 1: Ver cuántas asignaciones hay ahora ─────────────────
echo ""
echo "── Estado actual ──────────────────────────────────────────"
CURRENT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -tAc "SELECT COUNT(*) FROM technician_assignments;" 2>/dev/null || echo "0")
echo "   technician_assignments actuales: $CURRENT"

if [[ "$CURRENT" -gt 0 ]]; then
  echo ""
  echo "   Asignaciones por categoría:"
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "SELECT c.name AS categoria, COUNT(ta.id) AS tecnicos
        FROM technician_assignments ta
        JOIN categories c ON c.id = ta.\"categoryId\"
        GROUP BY c.name ORDER BY c.name;" 2>/dev/null || true
  echo ""
  read -rp "⚠ Ya existen $CURRENT asignaciones. ¿Continuar y agregar las del dump (skipDuplicates)? [s/N] " confirm
  [[ "$confirm" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 0; }
fi

# ── Paso 2: Extraer technician_assignments del dump ───────────
echo ""
echo "── Extrayendo technician_assignments del dump ─────────────"

# Detectar si el dump está dentro de un contenedor docker o es accesible localmente
# Intentamos directamente con pg_restore local primero
if command -v pg_restore &>/dev/null; then
  echo "   Usando pg_restore local..."
  TMP_SQL=$(mktemp /tmp/technician_assignments_XXXXXX.sql)
  pg_restore --data-only --table=technician_assignments "$DUMP_FILE" > "$TMP_SQL" 2>/dev/null || true
else
  # pg_restore dentro del contenedor Docker
  CONTAINER=$(docker ps --filter "name=tickets" --format "{{.Names}}" 2>/dev/null | \
    grep -v "postgres\|redis\|nginx\|backup" | head -1 || true)

  if [[ -z "$CONTAINER" ]]; then
    CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" 2>/dev/null | head -1 || true)
  fi

  if [[ -z "$CONTAINER" ]]; then
    echo "❌ No se encontró pg_restore local ni contenedor Docker activo."
    echo "   Instala postgresql-client o ejecuta este script desde el contenedor:"
    echo "   docker exec tickets-app bash docker/scripts/recover-technician-assignments.sh"
    exit 1
  fi

  echo "   Usando pg_restore dentro del contenedor: $CONTAINER"
  TMP_SQL=$(mktemp /tmp/technician_assignments_XXXXXX.sql)
  docker exec "$CONTAINER" pg_restore --data-only --table=technician_assignments \
    "/backups/$(basename "$DUMP_FILE")" > "$TMP_SQL" 2>/dev/null || \
  docker cp "$DUMP_FILE" "$CONTAINER:/tmp/restore_tmp.dump" && \
  docker exec "$CONTAINER" pg_restore --data-only --table=technician_assignments \
    /tmp/restore_tmp.dump > "$TMP_SQL" 2>/dev/null || true
fi

LINES=$(wc -l < "$TMP_SQL" | tr -d ' ')
echo "   SQL extraído: $LINES líneas"

if [[ "$LINES" -lt 3 ]]; then
  echo ""
  echo "⚠ El dump no contiene datos de technician_assignments, o la extracción falló."
  echo "  Esto puede pasar si el backup fue hecho con el módulo 'tickets' (que no incluía"
  echo "  technician_assignments hasta la corrección aplicada hoy)."
  echo ""
  echo "  SOLUCIÓN: Re-asigna los técnicos manualmente desde la UI:"
  echo "  → Admin → Tickets → Categorías → editar cada categoría → pestaña Técnicos"
  echo ""
  rm -f "$TMP_SQL"
  exit 0
fi

# ── Paso 3: Aplicar el SQL con ON CONFLICT DO NOTHING ─────────
echo ""
echo "── Restaurando asignaciones ───────────────────────────────"

# El SQL de pg_restore usa COPY; convertir a INSERT ON CONFLICT DO NOTHING
# para no romper la BD si algunos ya existen
TMP_INSERT=$(mktemp /tmp/technician_assignments_insert_XXXXXX.sql)

# Transformar COPY a INSERT usando awk
awk '
  /^COPY.*technician_assignments.*FROM stdin/ {
    in_copy=1
    # Extraer columnas del COPY
    match($0, /\(([^)]+)\)/, arr)
    cols=arr[1]
    next
  }
  in_copy && /^\\\./ {
    in_copy=0
    next
  }
  in_copy {
    n=split($0, vals, "\t")
    printf "INSERT INTO technician_assignments (%s) VALUES (", cols
    for(i=1;i<=n;i++) {
      v=vals[i]
      if(v=="\\N") printf "NULL"
      else {
        gsub(/\\/, "\\\\", v); gsub(/'\''/,"'\'''\''",v)
        printf "'\''" v "'\''"
      }
      if(i<n) printf ","
    }
    print ") ON CONFLICT DO NOTHING;"
    next
  }
' "$TMP_SQL" >> "$TMP_INSERT"

INSERT_LINES=$(grep -c "^INSERT" "$TMP_INSERT" 2>/dev/null || echo 0)
echo "   Insertando $INSERT_LINES asignaciones (skipDuplicates)..."

PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f "$TMP_INSERT" -q 2>&1 | grep -v "^$" || true

rm -f "$TMP_SQL" "$TMP_INSERT"

# ── Paso 4: Verificar resultado ────────────────────────────────
echo ""
echo "── Resultado final ────────────────────────────────────────"
AFTER=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -tAc "SELECT COUNT(*) FROM technician_assignments;" 2>/dev/null || echo "0")
echo "   technician_assignments ahora: $AFTER (antes: $CURRENT)"

echo ""
echo "   Asignaciones por categoría:"
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT c.name AS categoria, COUNT(ta.id) AS tecnicos,
             SUM(CASE WHEN ta.\"autoAssign\" THEN 1 ELSE 0 END) AS auto_assign
      FROM technician_assignments ta
      JOIN categories c ON c.id = ta.\"categoryId\"
      GROUP BY c.name ORDER BY c.name;" 2>/dev/null || true

if [[ "$AFTER" -gt "$CURRENT" ]]; then
  echo ""
  echo "✅ Se restauraron $((AFTER - CURRENT)) asignaciones."
else
  echo ""
  echo "ℹ️  No se añadieron asignaciones nuevas (puede que el dump no las tuviera"
  echo "   o que ya existían todas). Re-asigna manualmente desde la UI si es necesario:"
  echo "   → Admin → Tickets → Categorías → editar cada categoría → pestaña Técnicos"
fi
