-- AlterTable
ALTER TABLE "equipment_batches" ADD COLUMN     "accessories" JSONB,
ADD COLUMN     "condition" VARCHAR(20),
ADD COLUMN     "custom_values" JSONB,
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "property_type" VARCHAR(20);

-- CreateIndex
CREATE INDEX "equipment_batches_department_id_idx" ON "equipment_batches"("department_id");

-- CreateIndex
CREATE INDEX "equipment_batches_model_id_status_created_at_idx" ON "equipment_batches"("model_id", "status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "equipment_batches" ADD CONSTRAINT "equipment_batches_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
