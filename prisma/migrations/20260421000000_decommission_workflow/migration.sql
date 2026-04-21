-- ============================================================
-- Migración: Flujo de baja con dictamen técnico y elevación
-- Agrega estados intermedios y campos de revisión por rol
-- ============================================================

-- 1. Agregar nuevos valores al enum DecommissionStatus
-- PostgreSQL no permite ALTER TYPE ADD VALUE dentro de una transacción,
-- por eso se hace fuera de ella.
ALTER TYPE "DecommissionStatus" ADD VALUE IF NOT EXISTS 'TECHNICAL_REVIEW';
ALTER TYPE "DecommissionStatus" ADD VALUE IF NOT EXISTS 'MANAGER_REVIEW';

-- 2. Agregar campos de dictamen técnico
ALTER TABLE "decommission_requests"
  ADD COLUMN IF NOT EXISTS "technician_id"       TEXT,
  ADD COLUMN IF NOT EXISTS "technician_opinion"  TEXT,
  ADD COLUMN IF NOT EXISTS "technician_review_at" TIMESTAMP(3);

-- 3. Agregar campos de elevación del gestor
ALTER TABLE "decommission_requests"
  ADD COLUMN IF NOT EXISTS "manager_id"          TEXT,
  ADD COLUMN IF NOT EXISTS "manager_notes"       TEXT,
  ADD COLUMN IF NOT EXISTS "manager_elevated_at" TIMESTAMP(3);

-- 4. Foreign keys
ALTER TABLE "decommission_requests"
  ADD CONSTRAINT "decommission_requests_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "decommission_requests"
  ADD CONSTRAINT "decommission_requests_manager_id_fkey"
    FOREIGN KEY ("manager_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS "decommission_requests_technician_id_idx"
  ON "decommission_requests"("technician_id");

CREATE INDEX IF NOT EXISTS "decommission_requests_manager_id_idx"
  ON "decommission_requests"("manager_id");
