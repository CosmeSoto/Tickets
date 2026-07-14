-- AlterTable
ALTER TABLE "inventory_saved_reports" ADD COLUMN "pinned_order" INTEGER;

-- CreateIndex
CREATE INDEX "inventory_saved_reports_user_id_pinned_pinned_order_idx" ON "inventory_saved_reports"("user_id", "pinned", "pinned_order");
