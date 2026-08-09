-- Acceso a Base de conocimientos (módulo Tickets). Default true conserva el comportamiento actual.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "can_access_knowledge" BOOLEAN NOT NULL DEFAULT true;
