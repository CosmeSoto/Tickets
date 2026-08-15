-- Módulo Accesos: credenciales QR para personas externas sin cuentas de sistema.
CREATE TYPE "AccessSubjectType" AS ENUM ('TENANT_EMPLOYEE', 'AUTHORIZED_VISITOR', 'CONTRACTOR');
CREATE TYPE "AccessPassStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "AccessScanResult" AS ENUM (
  'VALID', 'EXPIRED', 'REVOKED', 'SUSPENDED', 'INACTIVE_SUBJECT', 'NOT_FOUND', 'OUT_OF_SCOPE'
);

ALTER TABLE "users"
  ADD COLUMN "access_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "can_manage_access" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users"
SET "access_enabled" = true, "can_manage_access" = true
WHERE "role" = 'ADMIN';

INSERT INTO "system_modules" (
  "key", "name", "description", "icon", "isActive", "order",
  "defaultForAdmin", "defaultForTech", "defaultForClient", "requiresManager",
  "familyScoped", "createdAt", "updatedAt"
)
VALUES (
  'access', 'Accesos', 'Pases QR verificables para personal externo, visitantes y contratistas por área',
  'ScanLine', true, 8, true, false, false, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "icon" = EXCLUDED."icon",
    "order" = EXCLUDED."order",
    "updatedAt" = CURRENT_TIMESTAMP;

CREATE TABLE "access_subjects" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "first_name" VARCHAR(120) NOT NULL,
  "last_name" VARCHAR(120) NOT NULL,
  "email" VARCHAR(320),
  "phone" VARCHAR(40),
  "photo_path" VARCHAR(500),
  "organization" VARCHAR(200),
  "access_type" "AccessSubjectType" NOT NULL DEFAULT 'AUTHORIZED_VISITOR',
  "purpose" VARCHAR(1000),
  "document_last4" VARCHAR(4),
  "privacy_accepted_at" TIMESTAMP(3),
  "privacy_notice_version" VARCHAR(50),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_passes" (
  "id" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "credential_code" VARCHAR(40) NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "status" "AccessPassStatus" NOT NULL DEFAULT 'ACTIVE',
  "valid_from" TIMESTAMP(3) NOT NULL,
  "valid_until" TIMESTAMP(3) NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "emailed_at" TIMESTAMP(3),
  "last_scanned_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "revoked_reason" VARCHAR(1000),
  "created_by_id" TEXT NOT NULL,
  "updated_by_id" TEXT,
  "revoked_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_passes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_scan_events" (
  "id" TEXT NOT NULL,
  "pass_id" TEXT,
  "family_id" TEXT,
  "agent_id" TEXT NOT NULL,
  "result" "AccessScanResult" NOT NULL,
  "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_address" VARCHAR(100),
  "user_agent" VARCHAR(1000),
  "failure_code" VARCHAR(80),
  CONSTRAINT "access_scan_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_passes_credential_code_key" ON "access_passes"("credential_code");
CREATE UNIQUE INDEX "access_passes_token_hash_key" ON "access_passes"("token_hash");
CREATE INDEX "access_subjects_family_id_is_active_idx" ON "access_subjects"("family_id", "is_active");
CREATE INDEX "access_subjects_family_id_last_name_first_name_idx" ON "access_subjects"("family_id", "last_name", "first_name");
CREATE INDEX "access_subjects_email_idx" ON "access_subjects"("email");
CREATE INDEX "access_passes_family_id_status_valid_until_idx" ON "access_passes"("family_id", "status", "valid_until");
CREATE INDEX "access_passes_subject_id_status_idx" ON "access_passes"("subject_id", "status");
CREATE INDEX "access_passes_last_scanned_at_idx" ON "access_passes"("last_scanned_at");
CREATE INDEX "access_scan_events_pass_id_scanned_at_idx" ON "access_scan_events"("pass_id", "scanned_at" DESC);
CREATE INDEX "access_scan_events_family_id_scanned_at_idx" ON "access_scan_events"("family_id", "scanned_at" DESC);
CREATE INDEX "access_scan_events_agent_id_scanned_at_idx" ON "access_scan_events"("agent_id", "scanned_at" DESC);

ALTER TABLE "access_subjects"
  ADD CONSTRAINT "access_subjects_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_passes"
  ADD CONSTRAINT "access_passes_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "access_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "access_passes_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "access_passes_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "access_passes_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "access_passes_revoked_by_id_fkey"
    FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "access_scan_events"
  ADD CONSTRAINT "access_scan_events_pass_id_fkey"
    FOREIGN KEY ("pass_id") REFERENCES "access_passes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "access_scan_events_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "access_scan_events_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
