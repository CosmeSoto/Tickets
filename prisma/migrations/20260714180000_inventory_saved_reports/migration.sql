-- CreateEnum
CREATE TYPE "SavedReportKind" AS ENUM ('DATASET', 'TEMPLATE');

-- CreateTable
CREATE TABLE "inventory_saved_reports" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "kind" "SavedReportKind" NOT NULL DEFAULT 'DATASET',
  "target_id" VARCHAR(100) NOT NULL,
  "family_id" TEXT,
  "filter_values" JSONB NOT NULL DEFAULT '{}',
  "visible_columns" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_saved_reports_user_id_updated_at_idx" ON "inventory_saved_reports"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_saved_reports_user_id_kind_idx" ON "inventory_saved_reports"("user_id", "kind");

-- AddForeignKey
ALTER TABLE "inventory_saved_reports" ADD CONSTRAINT "inventory_saved_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_saved_reports" ADD CONSTRAINT "inventory_saved_reports_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
