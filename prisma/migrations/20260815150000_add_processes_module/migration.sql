-- Módulo de procesos y procedimientos internos.
-- Conserva los diagramas como datos estructurados para poder regenerarlos.

CREATE TYPE "ProcessStatus" AS ENUM (
  'DRAFT',
  'PENDING_AREA_REVIEW',
  'PENDING_EXTERNAL_DPD',
  'PUBLISHED',
  'REJECTED',
  'OBSOLETE'
);

CREATE TYPE "ProcessCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ProcessDiagramType" AS ENUM ('SWIMLANE', 'SEQUENCE');
CREATE TYPE "ExternalReviewStatus" AS ENUM ('PENDING', 'SENT', 'REVIEWED', 'OBSERVED');

ALTER TABLE "users"
  ADD COLUMN "processes_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "can_manage_processes" BOOLEAN NOT NULL DEFAULT false;

-- Bootstrap: los administradores existentes administran el módulo desde su despliegue.
UPDATE "users"
SET "processes_enabled" = true, "can_manage_processes" = true
WHERE "role" = 'ADMIN';

INSERT INTO "system_modules" (
  "key", "name", "description", "icon", "isActive", "order",
  "defaultForAdmin", "defaultForTech", "defaultForClient", "requiresManager",
  "familyScoped", "createdAt", "updatedAt"
)
VALUES (
  'processes', 'Procesos y Procedimientos',
  'Catálogo interno, versiones y diagramas de procesos por área', 'Workflow',
  true, 7, true, false, false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "icon" = EXCLUDED."icon",
    "order" = EXCLUDED."order",
    "updatedAt" = CURRENT_TIMESTAMP;

CREATE TABLE "processes" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "title" VARCHAR(250) NOT NULL,
  "objective" TEXT,
  "scope" TEXT,
  "process_level" INTEGER NOT NULL DEFAULT 1,
  "parent_process_id" TEXT,
  "family_id" TEXT NOT NULL,
  "department_id" TEXT,
  "owner_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
  "criticality" "ProcessCriticality" NOT NULL DEFAULT 'MEDIUM',
  "review_every_months" INTEGER NOT NULL DEFAULT 12,
  "next_review_at" TIMESTAMP(3),
  "last_review_reminder_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_versions" (
  "id" TEXT NOT NULL,
  "process_id" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "content" JSONB,
  "change_summary" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "process_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_diagrams" (
  "id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "type" "ProcessDiagramType" NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "definition" JSONB NOT NULL,
  "rendered_artifact_path" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "process_diagrams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_attachments" (
  "id" TEXT NOT NULL,
  "process_id" TEXT NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "uploaded_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "process_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_approval_events" (
  "id" TEXT NOT NULL,
  "process_id" TEXT NOT NULL,
  "from_status" "ProcessStatus",
  "to_status" "ProcessStatus" NOT NULL,
  "notes" TEXT,
  "actor_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "process_approval_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_external_reviews" (
  "id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "provider" VARCHAR(150) NOT NULL DEFAULT 'Privacy Driver',
  "external_reference" VARCHAR(150),
  "status" "ExternalReviewStatus" NOT NULL DEFAULT 'PENDING',
  "sent_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "notes" TEXT,
  "evidence_path" TEXT,
  "recorded_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "process_external_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "processes_code_key" ON "processes"("code");
CREATE INDEX "processes_family_id_status_idx" ON "processes"("family_id", "status");
CREATE INDEX "processes_department_id_status_idx" ON "processes"("department_id", "status");
CREATE INDEX "processes_owner_id_status_idx" ON "processes"("owner_id", "status");
CREATE INDEX "processes_next_review_at_idx" ON "processes"("next_review_at");
CREATE INDEX "processes_parent_process_id_process_level_idx"
  ON "processes"("parent_process_id", "process_level");
CREATE UNIQUE INDEX "process_versions_process_id_version_number_key"
  ON "process_versions"("process_id", "version_number");
CREATE INDEX "process_versions_process_id_created_at_idx"
  ON "process_versions"("process_id", "created_at" DESC);
CREATE UNIQUE INDEX "process_diagrams_version_id_type_name_key"
  ON "process_diagrams"("version_id", "type", "name");
CREATE INDEX "process_diagrams_version_id_idx" ON "process_diagrams"("version_id");
CREATE INDEX "process_attachments_process_id_idx" ON "process_attachments"("process_id");
CREATE INDEX "process_approval_events_process_id_created_at_idx"
  ON "process_approval_events"("process_id", "created_at");
CREATE INDEX "process_external_reviews_version_id_status_idx"
  ON "process_external_reviews"("version_id", "status");

ALTER TABLE "processes"
  ADD CONSTRAINT "processes_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "processes_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "processes_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "processes_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "processes_parent_process_id_fkey"
    FOREIGN KEY ("parent_process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "process_versions"
  ADD CONSTRAINT "process_versions_process_id_fkey"
    FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "process_versions_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "process_diagrams"
  ADD CONSTRAINT "process_diagrams_version_id_fkey"
    FOREIGN KEY ("version_id") REFERENCES "process_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "process_attachments"
  ADD CONSTRAINT "process_attachments_process_id_fkey"
    FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "process_attachments_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "process_approval_events"
  ADD CONSTRAINT "process_approval_events_process_id_fkey"
    FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "process_approval_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "process_external_reviews"
  ADD CONSTRAINT "process_external_reviews_version_id_fkey"
    FOREIGN KEY ("version_id") REFERENCES "process_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "process_external_reviews_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
