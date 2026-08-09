-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill: preserve current name order within each family
WITH ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (PARTITION BY family_id ORDER BY name ASC) - 1)::INTEGER AS new_order
  FROM "warehouses"
)
UPDATE "warehouses" w
SET "order" = ranked.new_order
FROM ranked
WHERE w.id = ranked.id;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "warehouses_family_id_order_idx" ON "warehouses"("family_id", "order");
