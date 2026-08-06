-- Cierre automático al completar todos los checkpoints obligatorios (configurable por área).
ALTER TABLE "patrol_family_config"
  ADD COLUMN IF NOT EXISTS "auto_complete_when_all_required" BOOLEAN NOT NULL DEFAULT true;
