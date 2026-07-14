-- Gobernanza de suscripciones: facturación, asignación a cliente y actas

-- CreateEnum
CREATE TYPE "SubscriptionUsageStatus" AS ENUM ('ACTIVE', 'UNUSED', 'PENDING_CANCEL', 'CANCELLED');

-- AlterEnum
ALTER TYPE "DeliveryActType" ADD VALUE 'SUBSCRIPTION_ASSIGNMENT';

-- AlterTable contracts: datos financieros y responsables
ALTER TABLE "contracts" ADD COLUMN "custodian_user_id" TEXT;
ALTER TABLE "contracts" ADD COLUMN "backup_custodian_user_id" TEXT;
ALTER TABLE "contracts" ADD COLUMN "billing_account_email" VARCHAR(200);
ALTER TABLE "contracts" ADD COLUMN "billing_portal_url" VARCHAR(500);
ALTER TABLE "contracts" ADD COLUMN "vendor_account_id" VARCHAR(200);
ALTER TABLE "contracts" ADD COLUMN "payment_card_brand" VARCHAR(50);
ALTER TABLE "contracts" ADD COLUMN "payment_card_last4" VARCHAR(4);
ALTER TABLE "contracts" ADD COLUMN "payment_card_bank" VARCHAR(100);
ALTER TABLE "contracts" ADD COLUMN "payment_card_expiry" VARCHAR(7);
ALTER TABLE "contracts" ADD COLUMN "corporate_card_label" VARCHAR(100);
ALTER TABLE "contracts" ADD COLUMN "last_charge_date" TIMESTAMP(3);
ALTER TABLE "contracts" ADD COLUMN "last_charge_amount" DOUBLE PRECISION;
ALTER TABLE "contracts" ADD COLUMN "last_transaction_ref" VARCHAR(200);
ALTER TABLE "contracts" ADD COLUMN "subscription_usage_status" "SubscriptionUsageStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "contracts" ADD COLUMN "cancellation_notice_days" INTEGER;

-- AlterTable contract_payments: trazabilidad de transacciones
ALTER TABLE "contract_payments" ADD COLUMN "card_last4" VARCHAR(4);
ALTER TABLE "contract_payments" ADD COLUMN "card_brand" VARCHAR(50);
ALTER TABLE "contract_payments" ADD COLUMN "bank_entity" VARCHAR(100);
ALTER TABLE "contract_payments" ADD COLUMN "statement_period" TIMESTAMP(3);
ALTER TABLE "contract_payments" ADD COLUMN "transaction_id" VARCHAR(200);
ALTER TABLE "contract_payments" ADD COLUMN "charge_source" VARCHAR(50);

-- AlterTable delivery_acts: vínculo con asignaciones de contrato
ALTER TABLE "delivery_acts" ADD COLUMN "contract_assignment_id" TEXT;

-- CreateTable contract_assignments
CREATE TABLE "contract_assignments" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "deliverer_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "planned_end_date" TIMESTAMP(3),
    "actual_end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "change_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable contract_return_acts
CREATE TABLE "contract_return_acts" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "contract_assignment_id" TEXT NOT NULL,
    "delivery_act_id" TEXT NOT NULL,
    "contract_snapshot" JSONB NOT NULL,
    "withdrawal_reason" TEXT,
    "handover_notes" TEXT,
    "return_date" TIMESTAMP(3) NOT NULL,
    "receiver_info" JSONB NOT NULL,
    "deliverer_info" JSONB NOT NULL,
    "status" "ActStatus" NOT NULL DEFAULT 'PENDING',
    "acceptance_token" TEXT NOT NULL,
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "signature_timestamp" TIMESTAMP(3),
    "signature_ip" TEXT,
    "signature_user_agent" TEXT,
    "verification_hash" TEXT,
    "pdf_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_return_acts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_custodian_user_id_idx" ON "contracts"("custodian_user_id");
CREATE INDEX "contracts_subscription_usage_status_idx" ON "contracts"("subscription_usage_status");
CREATE INDEX "delivery_acts_act_type_idx" ON "delivery_acts"("act_type");
CREATE UNIQUE INDEX "delivery_acts_contract_assignment_id_key" ON "delivery_acts"("contract_assignment_id");
CREATE INDEX "contract_assignments_contract_id_is_active_idx" ON "contract_assignments"("contract_id", "is_active");
CREATE INDEX "contract_assignments_client_id_is_active_idx" ON "contract_assignments"("client_id", "is_active");
CREATE INDEX "contract_assignments_family_id_idx" ON "contract_assignments"("family_id");
CREATE UNIQUE INDEX "contract_return_acts_folio_key" ON "contract_return_acts"("folio");
CREATE UNIQUE INDEX "contract_return_acts_contract_assignment_id_key" ON "contract_return_acts"("contract_assignment_id");
CREATE UNIQUE INDEX "contract_return_acts_acceptance_token_key" ON "contract_return_acts"("acceptance_token");
CREATE INDEX "contract_return_acts_folio_idx" ON "contract_return_acts"("folio");
CREATE INDEX "contract_return_acts_status_expiration_date_idx" ON "contract_return_acts"("status", "expiration_date");
CREATE INDEX "contract_return_acts_acceptance_token_idx" ON "contract_return_acts"("acceptance_token");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_custodian_user_id_fkey" FOREIGN KEY ("custodian_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_backup_custodian_user_id_fkey" FOREIGN KEY ("backup_custodian_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_acts" ADD CONSTRAINT "delivery_acts_contract_assignment_id_fkey" FOREIGN KEY ("contract_assignment_id") REFERENCES "contract_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_assignments" ADD CONSTRAINT "contract_assignments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_assignments" ADD CONSTRAINT "contract_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_assignments" ADD CONSTRAINT "contract_assignments_deliverer_id_fkey" FOREIGN KEY ("deliverer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_assignments" ADD CONSTRAINT "contract_assignments_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_return_acts" ADD CONSTRAINT "contract_return_acts_contract_assignment_id_fkey" FOREIGN KEY ("contract_assignment_id") REFERENCES "contract_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
