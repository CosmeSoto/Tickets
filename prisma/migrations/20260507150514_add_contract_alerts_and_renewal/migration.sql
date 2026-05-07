-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "alert_60_days_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "alert_30_days_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "alert_15_days_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "last_alert_sent_at" TIMESTAMP(3),
ADD COLUMN "renewed_from_id" TEXT,
ADD COLUMN "renewed_to_id" TEXT,
ADD COLUMN "renewal_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "contracts_renewed_from_id_idx" ON "contracts"("renewed_from_id");

-- CreateIndex
CREATE INDEX "contracts_renewed_to_id_idx" ON "contracts"("renewed_to_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_renewed_from_id_fkey" FOREIGN KEY ("renewed_from_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_renewed_to_id_fkey" FOREIGN KEY ("renewed_to_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
