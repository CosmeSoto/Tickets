-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SCHEDULED', 'DUE', 'OVERDUE', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "contract_payments" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_date" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "payment_method" VARCHAR(100),
    "reference_number" VARCHAR(200),
    "notes" TEXT,
    "alert_7_days_sent" BOOLEAN NOT NULL DEFAULT false,
    "alert_due_sent" BOOLEAN NOT NULL DEFAULT false,
    "alert_overdue_sent" BOOLEAN NOT NULL DEFAULT false,
    "last_alert_sent_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_payments_contract_id_due_date_idx" ON "contract_payments"("contract_id", "due_date");

-- CreateIndex
CREATE INDEX "contract_payments_status_due_date_idx" ON "contract_payments"("status", "due_date");

-- CreateIndex
CREATE INDEX "contract_payments_created_by_idx" ON "contract_payments"("created_by");

-- CreateIndex
CREATE INDEX "contract_payments_due_date_idx" ON "contract_payments"("due_date");

-- AddForeignKey
ALTER TABLE "contract_payments" ADD CONSTRAINT "contract_payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_payments" ADD CONSTRAINT "contract_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
