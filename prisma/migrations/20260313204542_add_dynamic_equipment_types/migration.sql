/*
  Warnings:

  - You are about to drop the column `type` on the `equipment` table. All the data in the column will be lost.
  - Added the required column `type_id` to the `equipment` table without a default value. This is not possible if the table is not empty.

*/
-- Primero crear la tabla equipment_types
CREATE TABLE "equipment_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);

-- Crear índices para equipment_types
CREATE UNIQUE INDEX "equipment_types_code_key" ON "equipment_types"("code");
CREATE INDEX "equipment_types_is_active_order_idx" ON "equipment_types"("is_active", "order");

-- Poblar equipment_types con los tipos iniciales
INSERT INTO "equipment_types" ("id", "code", "name", "icon", "order", "is_active", "created_at", "updated_at")
VALUES 
  (gen_random_uuid(), 'LAPTOP', 'Laptop', 'Laptop', 1, true, NOW(), NOW()),
  (gen_random_uuid(), 'DESKTOP', 'Desktop', 'Monitor', 2, true, NOW(), NOW()),
  (gen_random_uuid(), 'MONITOR', 'Monitor', 'Monitor', 3, true, NOW(), NOW()),
  (gen_random_uuid(), 'PRINTER', 'Impresora', 'Printer', 4, true, NOW(), NOW()),
  (gen_random_uuid(), 'PHONE', 'Teléfono', 'Smartphone', 5, true, NOW(), NOW()),
  (gen_random_uuid(), 'TABLET', 'Tablet', 'Tablet', 6, true, NOW(), NOW()),
  (gen_random_uuid(), 'KEYBOARD', 'Teclado', 'Keyboard', 7, true, NOW(), NOW()),
  (gen_random_uuid(), 'MOUSE', 'Mouse', 'Mouse', 8, true, NOW(), NOW()),
  (gen_random_uuid(), 'HEADSET', 'Audífonos', 'Headphones', 9, true, NOW(), NOW()),
  (gen_random_uuid(), 'WEBCAM', 'Webcam', 'Video', 10, true, NOW(), NOW()),
  (gen_random_uuid(), 'DOCKING_STATION', 'Docking Station', 'Dock', 11, true, NOW(), NOW()),
  (gen_random_uuid(), 'UPS', 'UPS', 'Battery', 12, true, NOW(), NOW()),
  (gen_random_uuid(), 'ROUTER', 'Router', 'Router', 13, true, NOW(), NOW()),
  (gen_random_uuid(), 'SWITCH', 'Switch', 'Network', 14, true, NOW(), NOW()),
  (gen_random_uuid(), 'OTHER', 'Otro', 'Box', 15, true, NOW(), NOW());

-- Eliminar índice antiguo
DROP INDEX IF EXISTS "equipment_type_status_idx";

-- Agregar columna type_id como nullable primero
ALTER TABLE "equipment" ADD COLUMN "type_id" TEXT;

-- Si hay equipos existentes, migrar los datos del enum al nuevo sistema
-- (En este caso la tabla está vacía, pero por si acaso)
UPDATE "equipment" e
SET "type_id" = (
  SELECT id FROM "equipment_types" et 
  WHERE et.code = e.type::text
)
WHERE e.type IS NOT NULL;

-- Ahora eliminar la columna type antigua
ALTER TABLE "equipment" DROP COLUMN IF EXISTS "type";

-- Hacer type_id NOT NULL ahora que tiene valores
ALTER TABLE "equipment" ALTER COLUMN "type_id" SET NOT NULL;

-- Ajustar tipos de datos de campos rental
ALTER TABLE "equipment" 
  ALTER COLUMN "rental_provider" SET DATA TYPE TEXT,
  ALTER COLUMN "rental_contract_number" SET DATA TYPE TEXT,
  ALTER COLUMN "rental_contact_name" SET DATA TYPE TEXT,
  ALTER COLUMN "rental_contact_email" SET DATA TYPE TEXT,
  ALTER COLUMN "rental_contact_phone" SET DATA TYPE TEXT;

-- Eliminar el enum EquipmentType
DROP TYPE IF EXISTS "EquipmentType";

-- Crear nuevo índice
CREATE INDEX "equipment_type_id_status_idx" ON "equipment"("type_id", "status");

-- Agregar foreign key
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_type_id_fkey" 
  FOREIGN KEY ("type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
