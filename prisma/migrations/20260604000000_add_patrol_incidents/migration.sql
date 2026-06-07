-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED', 'ESCALATED');

-- CreateTable
CREATE TABLE "patrol_incidents" (
    "id" TEXT NOT NULL,
    "patrol_id" TEXT NOT NULL,
    "checkpoint_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "photo_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ticket_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrol_incidents_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "patrols" ADD COLUMN "reminder_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "patrol_photos" ADD COLUMN "incident_id" TEXT;

-- CreateIndex
CREATE INDEX "patrol_incidents_patrol_id_created_at_idx" ON "patrol_incidents"("patrol_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "patrol_incidents_agent_id_created_at_idx" ON "patrol_incidents"("agent_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "patrol_incidents_checkpoint_id_status_idx" ON "patrol_incidents"("checkpoint_id", "status");

-- CreateIndex
CREATE INDEX "patrol_incidents_status_severity_idx" ON "patrol_incidents"("status", "severity");

-- CreateIndex
CREATE INDEX "patrol_incidents_ticket_id_idx" ON "patrol_incidents"("ticket_id");

-- CreateIndex
CREATE INDEX "patrol_photos_incident_id_idx" ON "patrol_photos"("incident_id");

-- AddForeignKey
ALTER TABLE "patrol_incidents" ADD CONSTRAINT "patrol_incidents_patrol_id_fkey" FOREIGN KEY ("patrol_id") REFERENCES "patrols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_incidents" ADD CONSTRAINT "patrol_incidents_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "patrol_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_incidents" ADD CONSTRAINT "patrol_incidents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_incidents" ADD CONSTRAINT "patrol_incidents_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_incidents" ADD CONSTRAINT "patrol_incidents_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_photos" ADD CONSTRAINT "patrol_photos_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "patrol_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
