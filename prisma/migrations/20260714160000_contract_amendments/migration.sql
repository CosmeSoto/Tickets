-- CreateEnum
CREATE TYPE "ContractAmendmentType" AS ENUM (
  'PRICE_CHANGE',
  'TERM_EXTENSION',
  'TERM_REDUCTION',
  'SCOPE_CHANGE',
  'BILLING_CHANGE',
  'CANCELLATION',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "ContractAmendmentStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "contract_amendments" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "folio" VARCHAR(50) NOT NULL,
  "amendment_number" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "type" "ContractAmendmentType" NOT NULL DEFAULT 'OTHER',
  "status" "ContractAmendmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "effective_date" TIMESTAMP(3) NOT NULL,
  "apply_to_contract" BOOLEAN NOT NULL DEFAULT true,
  "previous_monthly_cost" DOUBLE PRECISION,
  "new_monthly_cost" DOUBLE PRECISION,
  "previous_total_value" DOUBLE PRECISION,
  "new_total_value" DOUBLE PRECISION,
  "previous_end_date" TIMESTAMP(3),
  "new_end_date" TIMESTAMP(3),
  "previous_billing_cycle" "BillingCycle",
  "new_billing_cycle" "BillingCycle",
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_amendments_folio_key" ON "contract_amendments"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "contract_amendments_contract_id_amendment_number_key" ON "contract_amendments"("contract_id", "amendment_number");

-- CreateIndex
CREATE INDEX "contract_amendments_contract_id_effective_date_idx" ON "contract_amendments"("contract_id", "effective_date");

-- CreateIndex
CREATE INDEX "contract_amendments_folio_idx" ON "contract_amendments"("folio");

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
