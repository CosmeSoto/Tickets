-- CreateEnum
CREATE TYPE "AcquisitionPaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "equipment_invoices" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "equipment_id"         UUID         NOT NULL,
    "invoice_number"       VARCHAR(100),
    "purchase_order_number" VARCHAR(100),
    "amount"               DOUBLE PRECISION NOT NULL,
    "currency"             VARCHAR(3)   NOT NULL DEFAULT 'USD',
    "due_date"             TIMESTAMP(3),
    "paid_date"            TIMESTAMP(3),
    "status"               "AcquisitionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method"       "PaymentMethodType",
    "supplier_id"          UUID,
    "supplier_name"        VARCHAR(200),
    "reference_number"     VARCHAR(200),
    "bank_entity"          VARCHAR(100),
    "card_last4"           VARCHAR(4),
    "card_brand"           VARCHAR(50),
    "transaction_id"       VARCHAR(200),
    "notes"                TEXT,
    "created_by"           UUID         NOT NULL,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_invoices_equipment_id_idx" ON "equipment_invoices"("equipment_id");
CREATE INDEX "equipment_invoices_supplier_id_idx" ON "equipment_invoices"("supplier_id");
CREATE INDEX "equipment_invoices_status_due_date_idx" ON "equipment_invoices"("status", "due_date");
CREATE INDEX "equipment_invoices_created_at_idx" ON "equipment_invoices"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "equipment_invoices"
    ADD CONSTRAINT "equipment_invoices_equipment_id_fkey"
    FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipment_invoices"
    ADD CONSTRAINT "equipment_invoices_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipment_invoices"
    ADD CONSTRAINT "equipment_invoices_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
