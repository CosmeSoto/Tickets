-- Catálogo de concesionarios / empresas para el módulo Accesos
CREATE TABLE "access_organizations" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "description" VARCHAR(500),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_organizations_code_key" ON "access_organizations"("code");
CREATE INDEX "access_organizations_is_active_order_idx" ON "access_organizations"("is_active", "order");

ALTER TABLE "access_subjects"
  ADD COLUMN "organization_id" TEXT,
  ADD COLUMN "privacy_accepted_by_id" TEXT;

CREATE INDEX "access_subjects_organization_id_idx" ON "access_subjects"("organization_id");

ALTER TABLE "access_subjects"
  ADD CONSTRAINT "access_subjects_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "access_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "access_subjects_privacy_accepted_by_id_fkey"
    FOREIGN KEY ("privacy_accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
