-- AlterTable
-- Solo agrega columnas nullable/con default y afloja "path" a nullable —
-- no rompe ninguna fila existente (queda storage_provider = 'local', igual
-- que hoy). Ver prisma/schema.prisma (model form_attachments) y
-- src/lib/services/cloud-storage-service.ts.
ALTER TABLE "form_attachments"
  ALTER COLUMN "path" DROP NOT NULL,
  ADD COLUMN "storage_provider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_url" TEXT;
