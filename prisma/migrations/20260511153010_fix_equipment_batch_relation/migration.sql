-- DropForeignKey
ALTER TABLE "equipment_batches" DROP CONSTRAINT "equipment_batches_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "equipment_batches" DROP CONSTRAINT "equipment_batches_warehouse_id_fkey";

-- AlterTable
ALTER TABLE "equipment_batches" ALTER COLUMN "supplier_id" DROP NOT NULL,
ALTER COLUMN "warehouse_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "equipment_batches" ADD CONSTRAINT "equipment_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_batches" ADD CONSTRAINT "equipment_batches_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "equipment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
