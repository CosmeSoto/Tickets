-- Columna opcional para backups por módulo (null = backup completo)
ALTER TABLE "backups" ADD COLUMN IF NOT EXISTS "module" TEXT;

CREATE INDEX IF NOT EXISTS "backups_module_createdAt_idx" ON "backups" ("module", "createdAt" DESC);
