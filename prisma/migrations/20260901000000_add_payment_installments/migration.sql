-- Pago por abonos: permite saldar equipment_invoices/license_invoices/
-- contract_payments en varios pagos parciales en vez de un solo pago
-- completo. El status "PARTIALLY_PAID" se deriva siempre de
-- sum(installments.amount) vs amount — nunca es un hecho independiente
-- (ver computeAcquisitionStatus/computePaymentStatus).

-- AlterEnum
ALTER TYPE "AcquisitionPaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- CreateTable
CREATE TABLE "equipment_invoice_installments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paid_date" TIMESTAMP(3) NOT NULL,
    "payment_method" "PaymentMethodType",
    "reference_number" VARCHAR(200),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_invoice_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_invoice_installments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paid_date" TIMESTAMP(3) NOT NULL,
    "payment_method" "PaymentMethodType",
    "reference_number" VARCHAR(200),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_invoice_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_payment_installments" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paid_date" TIMESTAMP(3) NOT NULL,
    "payment_method" VARCHAR(100),
    "reference_number" VARCHAR(200),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_invoice_installments_invoice_id_idx" ON "equipment_invoice_installments"("invoice_id");

-- CreateIndex
CREATE INDEX "equipment_invoice_installments_created_at_idx" ON "equipment_invoice_installments"("created_at" DESC);

-- CreateIndex
CREATE INDEX "license_invoice_installments_invoice_id_idx" ON "license_invoice_installments"("invoice_id");

-- CreateIndex
CREATE INDEX "license_invoice_installments_created_at_idx" ON "license_invoice_installments"("created_at" DESC);

-- CreateIndex
CREATE INDEX "contract_payment_installments_payment_id_idx" ON "contract_payment_installments"("payment_id");

-- CreateIndex
CREATE INDEX "contract_payment_installments_created_at_idx" ON "contract_payment_installments"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "equipment_invoice_installments" ADD CONSTRAINT "equipment_invoice_installments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "equipment_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_invoice_installments" ADD CONSTRAINT "equipment_invoice_installments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_invoice_installments" ADD CONSTRAINT "license_invoice_installments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "license_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_invoice_installments" ADD CONSTRAINT "license_invoice_installments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_payment_installments" ADD CONSTRAINT "contract_payment_installments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "contract_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_payment_installments" ADD CONSTRAINT "contract_payment_installments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
