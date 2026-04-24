-- AlterTable: agregar campo inventory_enabled a inventory_family_config
ALTER TABLE "inventory_family_config" ADD COLUMN "inventory_enabled" BOOLEAN NOT NULL DEFAULT true;
