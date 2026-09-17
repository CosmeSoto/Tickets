-- AlterTable
ALTER TABLE "software_licenses" ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "batch_renewal_linked" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "license_batches" (
    "id" TEXT NOT NULL,
    "batch_code" VARCHAR(50) NOT NULL,
    "license_type_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "supplier_id" TEXT,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "unit_cost" DOUBLE PRECISION NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "invoice_number" VARCHAR(100),
    "purchase_order_number" VARCHAR(100),
    "department_id" TEXT,
    "renewal_date" TIMESTAMP(3),
    "renewal_cost" DOUBLE PRECISION,
    "renewal_frequency" "LicenseRenewalFrequency",
    "custom_frequency_months" INTEGER,
    "received_by" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "license_batches_batch_code_key" ON "license_batches"("batch_code");

-- CreateIndex
CREATE INDEX "license_batches_license_type_id_idx" ON "license_batches"("license_type_id");

-- CreateIndex
CREATE INDEX "license_batches_purchase_date_idx" ON "license_batches"("purchase_date");

-- CreateIndex
CREATE INDEX "software_licenses_batch_id_idx" ON "software_licenses"("batch_id");

-- AddForeignKey
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "license_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_batches" ADD CONSTRAINT "license_batches_license_type_id_fkey" FOREIGN KEY ("license_type_id") REFERENCES "license_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_batches" ADD CONSTRAINT "license_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_batches" ADD CONSTRAINT "license_batches_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_batches" ADD CONSTRAINT "license_batches_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

