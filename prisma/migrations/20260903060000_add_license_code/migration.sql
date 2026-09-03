-- Código de licencias, mismo formato que equipos (FAMILIA-LIC-FA-AÑO-SECUENCIAL,
-- ej. TECH-LIC-FA-2026-0001). El generador (asset-code-generator.ts) ya
-- soportaba el subtipo LICENSE desde antes — prefijo "LIC" y conteo por
-- familia/año — pero el código resultante se descartaba al crear una
-- licencia porque esta columna nunca existió: quedó a medio implementar.
-- Ahora se agrega, con backfill para las licencias existentes usando el
-- mismo criterio (secuencial por familia+año, en orden de creación) para
-- que coincida con lo que el generador les habría asignado en su momento.

-- AlterTable
ALTER TABLE "software_licenses" ADD COLUMN "code" TEXT;

-- Backfill
WITH ranked AS (
  SELECT
    sl.id,
    COALESCE(
      NULLIF(UPPER(LEFT(COALESCE(ifc.code_prefix, ''), 4)), ''),
      UPPER(LEFT(COALESCE(f.code, 'INV'), 4))
    ) AS family_code,
    EXTRACT(YEAR FROM sl.created_at)::int AS yr,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(lt.family_id, 'NONE'), EXTRACT(YEAR FROM sl.created_at)
      ORDER BY sl.created_at, sl.id
    ) AS seq
  FROM "software_licenses" sl
  LEFT JOIN "license_types" lt ON lt.id = sl.type_id
  LEFT JOIN "families" f ON f.id = lt.family_id
  LEFT JOIN "inventory_family_config" ifc ON ifc.family_id = lt.family_id
)
UPDATE "software_licenses" sl
SET "code" = ranked.family_code || '-LIC-FA-' || ranked.yr || '-' || LPAD(ranked.seq::text, 4, '0')
FROM ranked
WHERE ranked.id = sl.id;

-- A partir de acá todas las licencias tienen código único — se puede exigir.
ALTER TABLE "software_licenses" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "software_licenses_code_key" ON "software_licenses"("code");
