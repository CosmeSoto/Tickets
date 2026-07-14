-- AlterTable
ALTER TABLE "inventory_saved_reports" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "inventory_saved_reports_user_id_pinned_idx" ON "inventory_saved_reports"("user_id", "pinned");
