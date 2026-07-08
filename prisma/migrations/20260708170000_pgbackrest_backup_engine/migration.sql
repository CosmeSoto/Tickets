-- pgBackRest: motor unificado de respaldos
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "engine" TEXT NOT NULL DEFAULT 'pgbackrest';
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "backupKind" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "label" TEXT;

CREATE INDEX IF NOT EXISTS "backups_engine_backupKind_createdAt_idx"
  ON "backups"("engine", "backupKind", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "backups_label_idx" ON "backups"("label");

-- Migrar respaldos existentes basados en pg_dump
UPDATE "backups"
SET "engine" = 'export', "backupKind" = 'export'
WHERE "filename" LIKE '%.dump' OR "filename" LIKE '%.json';

DROP INDEX IF EXISTS "backups_module_createdAt_idx";
