-- Vincular mantenimientos a contratos de soporte/mantenimiento (opcional).
ALTER TABLE "maintenance_records"
ADD COLUMN IF NOT EXISTS "contract_id" TEXT;

CREATE INDEX IF NOT EXISTS "maintenance_records_contract_id_idx"
ON "maintenance_records"("contract_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_records_contract_id_fkey'
  ) THEN
    ALTER TABLE "maintenance_records"
    ADD CONSTRAINT "maintenance_records_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
