-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "model_id" TEXT;

-- CreateIndex
CREATE INDEX "contracts_model_id_idx" ON "contracts"("model_id");

-- CreateIndex
CREATE INDEX "contracts_batch_id_idx" ON "contracts"("batch_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "equipment_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "equipment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
