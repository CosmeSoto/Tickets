-- Campos que ReturnActService ya escribía pero no existían en return_acts
ALTER TABLE "return_acts" ADD COLUMN IF NOT EXISTS "equipment_snapshot" JSONB;
ALTER TABLE "return_acts" ADD COLUMN IF NOT EXISTS "missing_accessories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "return_acts" ADD COLUMN IF NOT EXISTS "damage_description" TEXT;
ALTER TABLE "return_acts" ADD COLUMN IF NOT EXISTS "terms_version" TEXT NOT NULL DEFAULT '1.0';

-- Backfill mínimo para filas históricas (si las hay) antes de NOT NULL
UPDATE "return_acts"
SET "equipment_snapshot" = '{}'::jsonb
WHERE "equipment_snapshot" IS NULL;

ALTER TABLE "return_acts" ALTER COLUMN "equipment_snapshot" SET NOT NULL;

-- Relación opcional a delivery_acts (delivery_act_id ya existía como scalar)
CREATE INDEX IF NOT EXISTS "return_acts_delivery_act_id_idx" ON "return_acts"("delivery_act_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'return_acts_delivery_act_id_fkey'
  ) THEN
    ALTER TABLE "return_acts"
      ADD CONSTRAINT "return_acts_delivery_act_id_fkey"
      FOREIGN KEY ("delivery_act_id") REFERENCES "delivery_acts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
