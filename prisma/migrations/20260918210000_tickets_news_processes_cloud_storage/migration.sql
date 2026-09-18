-- AlterTable
-- Fase 2 del plan de adjuntos en la nube: mismo patrón ya aplicado a
-- form_attachments, ahora en tickets/noticias/procesos. Solo agrega columnas
-- nullable/con default y afloja "path" — no rompe ninguna fila existente.
ALTER TABLE "attachments"
  ALTER COLUMN "path" DROP NOT NULL,
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "externalUrl" TEXT;

ALTER TABLE "news_attachments"
  ALTER COLUMN "path" DROP NOT NULL,
  ADD COLUMN "storage_provider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_url" TEXT;

ALTER TABLE "process_attachments"
  ALTER COLUMN "path" DROP NOT NULL,
  ADD COLUMN "storage_provider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_url" TEXT;
