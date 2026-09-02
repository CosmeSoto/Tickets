-- Plan de cuotas para facturas de equipo/licencia: cada cuota es simplemente
-- otra fila de equipment_invoices/license_invoices, agrupada por
-- schedule_group_id (filas "hermanas", no una jerarquía nueva). null en
-- schedule_group_id = factura de pago único (comportamiento de siempre).

-- AlterTable
ALTER TABLE "equipment_invoices" ADD COLUMN "schedule_group_id" TEXT;
ALTER TABLE "equipment_invoices" ADD COLUMN "installment_number" INTEGER;
ALTER TABLE "equipment_invoices" ADD COLUMN "installment_count" INTEGER;

-- CreateIndex
CREATE INDEX "equipment_invoices_schedule_group_id_idx" ON "equipment_invoices"("schedule_group_id");

-- AlterTable
ALTER TABLE "license_invoices" ADD COLUMN "schedule_group_id" TEXT;
ALTER TABLE "license_invoices" ADD COLUMN "installment_number" INTEGER;
ALTER TABLE "license_invoices" ADD COLUMN "installment_count" INTEGER;

-- CreateIndex
CREATE INDEX "license_invoices_schedule_group_id_idx" ON "license_invoices"("schedule_group_id");
