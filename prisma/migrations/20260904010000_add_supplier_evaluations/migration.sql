-- Calificación de proveedores: reemplaza el Excel "CALIFICACIÓN PROVEEDORES"
-- (año, 6 criterios 0-5, total y clasificación A/B/C) por un historial en el
-- sistema, ligado 1-a-muchos a `suppliers`. total/classification se calculan
-- y persisten en el servidor (ver src/lib/inventory/supplier-qualification.ts)
-- a partir de umbrales configurables en system_settings.

-- CreateTable
CREATE TABLE "supplier_evaluations" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "detail" VARCHAR(200),
    "quality" INTEGER NOT NULL,
    "credit_time" INTEGER NOT NULL,
    "delivery_time" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "references_score" INTEGER NOT NULL,
    "equipment_score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "classification" VARCHAR(1) NOT NULL,
    "notes" TEXT,
    "evaluated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_evaluations_supplier_id_year_idx" ON "supplier_evaluations"("supplier_id", "year");

-- CreateIndex
CREATE INDEX "supplier_evaluations_year_classification_idx" ON "supplier_evaluations"("year", "classification");

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_evaluated_by_id_fkey" FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
