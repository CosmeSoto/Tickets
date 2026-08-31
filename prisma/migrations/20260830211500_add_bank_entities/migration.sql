-- Catálogo simple de bancos/entidades financieras, para alimentar el
-- selector reutilizable del campo "Banco / Entidad" (antes texto libre
-- duplicado en varios formularios). No es FK de nada: los campos existentes
-- (equipment_invoices.bank_entity, suppliers.bank_name) siguen siendo texto
-- libre; esta tabla solo respalda las sugerencias con crear/editar/eliminar.

-- CreateTable
CREATE TABLE "bank_entities" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_entities_name_key" ON "bank_entities"("name");

-- CreateIndex
CREATE INDEX "bank_entities_is_active_order_idx" ON "bank_entities"("is_active", "order");
