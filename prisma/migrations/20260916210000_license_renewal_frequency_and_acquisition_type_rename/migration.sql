-- CreateEnum
CREATE TYPE "LicenseAcquisitionType" AS ENUM ('SOFTWARE', 'SERVICE_EXTERNAL', 'MAINTENANCE', 'INSURANCE', 'SLA');

-- CreateEnum
CREATE TYPE "LicenseRenewalFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- AlterTable
ALTER TABLE "software_licenses" DROP COLUMN "contract_type",
ADD COLUMN     "acquisition_type" "LicenseAcquisitionType",
ADD COLUMN     "custom_frequency_months" INTEGER,
ADD COLUMN     "expiration_alert_first_sent_at" TIMESTAMP(3),
ADD COLUMN     "expiration_alert_second_sent_at" TIMESTAMP(3),
ADD COLUMN     "payment_alert_first_sent_at" TIMESTAMP(3),
ADD COLUMN     "payment_alert_second_sent_at" TIMESTAMP(3),
ADD COLUMN     "renewal_frequency" "LicenseRenewalFrequency";

-- DropEnum
DROP TYPE "ContractType";

-- CreateTable
CREATE TABLE "license_renewal_history" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "previous_renewal_date" TIMESTAMP(3),
    "new_renewal_date" TIMESTAMP(3),
    "previous_renewal_cost" DOUBLE PRECISION,
    "new_renewal_cost" DOUBLE PRECISION,
    "previous_frequency" "LicenseRenewalFrequency",
    "new_frequency" "LicenseRenewalFrequency",
    "changed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_renewal_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "license_renewal_history_license_id_created_at_idx" ON "license_renewal_history"("license_id", "created_at");

-- AddForeignKey
ALTER TABLE "license_renewal_history" ADD CONSTRAINT "license_renewal_history_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "software_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_renewal_history" ADD CONSTRAINT "license_renewal_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

