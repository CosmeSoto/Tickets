/*
  Warnings:

  - A unique constraint covering the columns `[schedule_id,scheduled_start]` on the table `patrols` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "patrol_photos" DROP CONSTRAINT "patrol_photos_patrol_id_fkey";

-- DropIndex
DROP INDEX "tickets_check_in_id_idx";

-- AlterTable
ALTER TABLE "asset_requests" ADD COLUMN     "sla_deadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "patrol_family_config" ADD COLUMN     "reminder_minutes_before" INTEGER NOT NULL DEFAULT 5,
ALTER COLUMN "geofence_radius_meters" SET DEFAULT 1,
ALTER COLUMN "grace_period_minutes" SET DEFAULT 5;

-- AlterTable
ALTER TABLE "sla_violations" ADD COLUMN     "asset_request_id" TEXT,
ALTER COLUMN "ticket_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "patrol_family_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrol_family_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_request_sla_metrics" (
    "id" TEXT NOT NULL,
    "asset_request_id" TEXT NOT NULL,
    "sla_policy_id" TEXT NOT NULL,
    "response_deadline" TIMESTAMP(3),
    "resolution_deadline" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "fulfilled_at" TIMESTAMP(3),
    "response_sla_met" BOOLEAN,
    "resolution_sla_met" BOOLEAN,
    "response_time_minutes" INTEGER,
    "fulfillment_time_minutes" INTEGER,
    "business_hours_elapsed" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_request_sla_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patrol_family_assignments_user_id_is_active_idx" ON "patrol_family_assignments"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "patrol_family_assignments_family_id_is_active_idx" ON "patrol_family_assignments"("family_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "patrol_family_assignments_user_id_family_id_key" ON "patrol_family_assignments"("user_id", "family_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_request_sla_metrics_asset_request_id_key" ON "asset_request_sla_metrics"("asset_request_id");

-- CreateIndex
CREATE INDEX "asset_request_sla_metrics_asset_request_id_idx" ON "asset_request_sla_metrics"("asset_request_id");

-- CreateIndex
CREATE INDEX "asset_request_sla_metrics_response_deadline_resolution_dead_idx" ON "asset_request_sla_metrics"("response_deadline", "resolution_deadline");

-- CreateIndex
CREATE INDEX "asset_requests_sla_deadline_idx" ON "asset_requests"("sla_deadline");

-- CreateIndex
CREATE UNIQUE INDEX "patrols_schedule_id_scheduled_start_key" ON "patrols"("schedule_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "sla_violations_asset_request_id_is_resolved_idx" ON "sla_violations"("asset_request_id", "is_resolved");

-- AddForeignKey
ALTER TABLE "sla_violations" ADD CONSTRAINT "sla_violations_asset_request_id_fkey" FOREIGN KEY ("asset_request_id") REFERENCES "asset_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_family_assignments" ADD CONSTRAINT "patrol_family_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_family_assignments" ADD CONSTRAINT "patrol_family_assignments_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_request_sla_metrics" ADD CONSTRAINT "asset_request_sla_metrics_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_request_sla_metrics" ADD CONSTRAINT "asset_request_sla_metrics_asset_request_id_fkey" FOREIGN KEY ("asset_request_id") REFERENCES "asset_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
