-- AlterTable: Agregar campos para equipos rentados/alquilados
ALTER TABLE "equipment" ADD COLUMN "rental_provider" VARCHAR(255);
ALTER TABLE "equipment" ADD COLUMN "rental_contract_number" VARCHAR(100);
ALTER TABLE "equipment" ADD COLUMN "rental_start_date" TIMESTAMP(3);
ALTER TABLE "equipment" ADD COLUMN "rental_end_date" TIMESTAMP(3);
ALTER TABLE "equipment" ADD COLUMN "rental_monthly_cost" DOUBLE PRECISION;
ALTER TABLE "equipment" ADD COLUMN "rental_contact_name" VARCHAR(255);
ALTER TABLE "equipment" ADD COLUMN "rental_contact_email" VARCHAR(255);
ALTER TABLE "equipment" ADD COLUMN "rental_contact_phone" VARCHAR(50);
ALTER TABLE "equipment" ADD COLUMN "rental_notes" TEXT;

-- Crear índice para búsquedas por proveedor
CREATE INDEX "equipment_rental_provider_idx" ON "equipment"("rental_provider");

-- Crear índice para búsquedas por fecha de fin de renta
CREATE INDEX "equipment_rental_end_date_idx" ON "equipment"("rental_end_date");

-- Crear índice compuesto para reportes de equipos rentados
CREATE INDEX "equipment_ownership_rental_idx" ON "equipment"("ownership_type", "rental_end_date") WHERE "ownership_type" = 'RENTAL';
