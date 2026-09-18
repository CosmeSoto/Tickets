-- AlterTable
-- Fase 3 del plan de adjuntos en la nube: mismo patrón ya aplicado a
-- form_attachments/attachments/news_attachments/process_attachments, ahora
-- en equipos/licencias/contratos. Solo agrega columnas nullable/con default
-- y afloja "path" — no rompe ninguna fila existente.
ALTER TABLE "equipment_attachments"
  ALTER COLUMN "path" DROP NOT NULL,
  ADD COLUMN "storage_provider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_url" TEXT;

ALTER TABLE "license_attachments"
  ALTER COLUMN "path" DROP NOT NULL,
  ADD COLUMN "storage_provider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_url" TEXT;

ALTER TABLE "contract_attachments"
  ALTER COLUMN "path" DROP NOT NULL,
  ADD COLUMN "storage_provider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_url" TEXT;
