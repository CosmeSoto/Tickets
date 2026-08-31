-- Datos de compra opcionales en movimientos de stock (solo aplican a
-- type=ENTRY) — así "Entrada (compra/ingreso)" registra cantidad + costo +
-- factura en una sola acción, sin necesitar una tarjeta de Facturas aparte
-- para Suministros. costPerUnit/supplierId del suministro se recalculan
-- solos desde el ENTRY con datos de compra más reciente.

-- AlterTable
ALTER TABLE "stock_movements"
    ADD COLUMN "amount" DOUBLE PRECISION,
    ADD COLUMN "currency" VARCHAR(3),
    ADD COLUMN "invoice_number" VARCHAR(100),
    ADD COLUMN "purchase_order_number" VARCHAR(100),
    ADD COLUMN "supplier_id" TEXT,
    ADD COLUMN "payment_method" "PaymentMethodType",
    ADD COLUMN "bank_entity" VARCHAR(100),
    ADD COLUMN "reference_number" VARCHAR(200),
    ADD COLUMN "card_last4" VARCHAR(4),
    ADD COLUMN "card_brand" VARCHAR(50),
    ADD COLUMN "transaction_id" VARCHAR(200);

-- CreateIndex
CREATE INDEX "stock_movements_supplier_id_idx" ON "stock_movements"("supplier_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
