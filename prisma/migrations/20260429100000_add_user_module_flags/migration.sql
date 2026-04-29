-- Add explicit module control flags to users
-- ticketsEnabled: controls whether the user sees the Tickets module (default true for all)
-- inventoryEnabled: controls whether the user sees the Inventory module (default false, must be explicitly enabled)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ticketsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inventoryEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Existing users with canManageInventory=true should also have inventoryEnabled=true
UPDATE "users" SET "inventoryEnabled" = true WHERE "canManageInventory" = true;
