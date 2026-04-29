-- Create system_modules catalog table
-- This table defines all available modules in the system and their defaults per role

CREATE TABLE IF NOT EXISTS "system_modules" (
  "key"              TEXT NOT NULL PRIMARY KEY,
  "name"             TEXT NOT NULL,
  "description"      TEXT,
  "icon"             TEXT,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "order"            INTEGER NOT NULL DEFAULT 0,
  "defaultForAdmin"  BOOLEAN NOT NULL DEFAULT true,
  "defaultForTech"   BOOLEAN NOT NULL DEFAULT false,
  "defaultForClient" BOOLEAN NOT NULL DEFAULT false,
  "requiresManager"  BOOLEAN NOT NULL DEFAULT false,
  "familyScoped"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "system_modules_isActive_order_idx" ON "system_modules"("isActive", "order");

-- Seed the two existing modules
INSERT INTO "system_modules" ("key", "name", "description", "icon", "isActive", "order", "defaultForAdmin", "defaultForTech", "defaultForClient", "requiresManager", "familyScoped", "updatedAt")
VALUES
  ('tickets',   'Tickets de Soporte',  'Gestión de tickets de soporte técnico. Los técnicos atienden tickets, los clientes los crean.',  'Ticket',  true, 1, true, true,  true,  false, true, CURRENT_TIMESTAMP),
  ('inventory', 'Inventario',          'Gestión de activos, equipos, consumibles y licencias. Requiere asignación a familias.',           'Package', true, 2, true, false, false, true,  true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
