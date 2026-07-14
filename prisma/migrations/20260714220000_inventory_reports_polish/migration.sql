-- AlterTable
ALTER TABLE "inventory_saved_reports" ADD COLUMN "pinned_span" INTEGER NOT NULL DEFAULT 1;

-- CreateEnum
CREATE TYPE "ReportExportFormat" AS ENUM ('CSV', 'PDF', 'BOTH');

-- AlterTable
ALTER TABLE "inventory_scheduled_reports" ADD COLUMN "export_format" "ReportExportFormat" NOT NULL DEFAULT 'BOTH';
