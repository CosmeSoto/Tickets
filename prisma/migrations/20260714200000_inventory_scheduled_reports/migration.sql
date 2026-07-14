-- CreateEnum
CREATE TYPE "ReportScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "inventory_scheduled_reports" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "saved_report_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "frequency" "ReportScheduleFrequency" NOT NULL DEFAULT 'WEEKLY',
  "schedule_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
  "day_of_week" INTEGER,
  "day_of_month" INTEGER,
  "recipients" JSONB NOT NULL DEFAULT '[]',
  "last_run_at" TIMESTAMP(3),
  "next_run_at" TIMESTAMP(3),
  "last_status" VARCHAR(20),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_scheduled_reports_enabled_next_run_at_idx" ON "inventory_scheduled_reports"("enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "inventory_scheduled_reports_user_id_created_at_idx" ON "inventory_scheduled_reports"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "inventory_scheduled_reports" ADD CONSTRAINT "inventory_scheduled_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_scheduled_reports" ADD CONSTRAINT "inventory_scheduled_reports_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "inventory_saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
