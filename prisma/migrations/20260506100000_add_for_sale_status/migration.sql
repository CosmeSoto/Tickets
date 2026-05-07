-- Agregar FOR_SALE al enum EquipmentStatus
ALTER TYPE "EquipmentStatus" ADD VALUE IF NOT EXISTS 'FOR_SALE';

-- Agregar campo saleListingPrice al modelo equipment
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "sale_listing_price" DOUBLE PRECISION;

-- Agregar campo contactWhatsapp al modelo families
ALTER TABLE "families" ADD COLUMN IF NOT EXISTS "contact_whatsapp" VARCHAR(30);
