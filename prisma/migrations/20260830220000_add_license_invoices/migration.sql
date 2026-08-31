-- Libro de facturas/pagos de adquisición de licencias — mismo propósito y
-- forma que equipment_invoices, para licencias. Los campos planos de
-- software_licenses (cost/purchase_date/invoice_number/purchase_order_number)
-- se siguen usando como espejo, sincronizado automáticamente desde aquí.

-- CreateTable
CREATE TABLE "license_invoices" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(100),
    "purchase_order_number" VARCHAR(100),
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "due_date" TIMESTAMP(3),
    "paid_date" TIMESTAMP(3),
    "status" "AcquisitionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" "PaymentMethodType",
    "supplier_id" TEXT,
    "supplier_name" VARCHAR(200),
    "reference_number" VARCHAR(200),
    "bank_entity" VARCHAR(100),
    "card_last4" VARCHAR(4),
    "card_brand" VARCHAR(50),
    "transaction_id" VARCHAR(200),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "license_invoices_license_id_idx" ON "license_invoices"("license_id");

-- CreateIndex
CREATE INDEX "license_invoices_supplier_id_idx" ON "license_invoices"("supplier_id");

-- CreateIndex
CREATE INDEX "license_invoices_status_due_date_idx" ON "license_invoices"("status", "due_date");

-- CreateIndex
CREATE INDEX "license_invoices_created_at_idx" ON "license_invoices"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "license_invoices" ADD CONSTRAINT "license_invoices_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "software_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_invoices" ADD CONSTRAINT "license_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_invoices" ADD CONSTRAINT "license_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
