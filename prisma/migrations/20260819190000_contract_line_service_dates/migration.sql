-- Fechas de renta/servicio por línea (activos que entran o salen en distinto momento).
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "service_start_date" TIMESTAMP(3);
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "service_end_date" TIMESTAMP(3);
