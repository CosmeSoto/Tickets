-- Preferencias de notificación por módulo (tickets / inventario / rondas)
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "notifyTickets" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "notifyInventory" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "notifyPatrols" BOOLEAN NOT NULL DEFAULT true;
