/*
  Warnings:

  - Added the required column `model_id` to the `equipment` table without a default value. This is not possible if the table is not empty.

*/

-- ============================================
-- PASO 1: Crear tablas nuevas
-- ============================================

-- CreateTable equipment_models
CREATE TABLE "equipment_models" (
    "id" TEXT NOT NULL,
    "brand" VARCHAR(100) NOT NULL,
    "model" VARCHAR(200) NOT NULL,
    "sku" VARCHAR(100),
    "type_id" TEXT NOT NULL,
    "specifications" JSONB,
    "defaultAccessories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "standard_price" DOUBLE PRECISION,
    "model_photo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable equipment_batches
CREATE TABLE "equipment_batches" (
    "id" TEXT NOT NULL,
    "batchCode" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "model_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_price" DOUBLE PRECISION NOT NULL,
    "invoice_number" VARCHAR(100),
    "purchase_order_number" VARCHAR(100),
    "warehouse_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'received',
    "received_by" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_batches_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- PASO 2: Migrar datos existentes
-- ============================================

-- Extraer modelos únicos de equipment existente
INSERT INTO equipment_models (id, brand, model, type_id, specifications, model_photo_url, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  brand,
  model,
  type_id,
  specifications,
  photo_url as model_photo_url,
  MIN(created_at) as created_at,
  NOW() as updated_at
FROM equipment
WHERE brand IS NOT NULL AND brand != ''
  AND model IS NOT NULL AND model != ''
  AND type_id IS NOT NULL
GROUP BY brand, model, type_id, specifications, photo_url
ON CONFLICT DO NOTHING;

-- ============================================
-- PASO 3: Agregar columnas a equipment
-- ============================================

-- Agregar model_id (nullable temporalmente)
ALTER TABLE "equipment" ADD COLUMN "model_id" TEXT;

-- Agregar batch_id (nullable)
ALTER TABLE "equipment" ADD COLUMN "batch_id" TEXT;

-- ============================================
-- PASO 4: Vincular equipment con equipment_models
-- ============================================

UPDATE equipment e
SET model_id = em.id
FROM equipment_models em
WHERE e.brand = em.brand
  AND e.model = em.model
  AND e.type_id = em.type_id;

-- ============================================
-- PASO 5: Hacer model_id NOT NULL
-- ============================================

ALTER TABLE "equipment" ALTER COLUMN "model_id" SET NOT NULL;

-- ============================================
-- PASO 6: Crear índices
-- ============================================

-- Índices equipment_models
CREATE UNIQUE INDEX "equipment_models_sku_key" ON "equipment_models"("sku");
CREATE INDEX "equipment_models_type_id_is_active_idx" ON "equipment_models"("type_id", "is_active");
CREATE INDEX "equipment_models_brand_model_idx" ON "equipment_models"("brand", "model");
CREATE UNIQUE INDEX "equipment_models_brand_model_type_id_key" ON "equipment_models"("brand", "model", "type_id");

-- Índices equipment_batches
CREATE UNIQUE INDEX "equipment_batches_batchCode_key" ON "equipment_batches"("batchCode");
CREATE INDEX "equipment_batches_model_id_status_idx" ON "equipment_batches"("model_id", "status");
CREATE INDEX "equipment_batches_supplier_id_idx" ON "equipment_batches"("supplier_id");
CREATE INDEX "equipment_batches_warehouse_id_idx" ON "equipment_batches"("warehouse_id");
CREATE INDEX "equipment_batches_purchase_date_idx" ON "equipment_batches"("purchase_date");

-- Índices equipment
CREATE INDEX "equipment_model_id_status_idx" ON "equipment"("model_id", "status");
CREATE INDEX "equipment_batch_id_idx" ON "equipment"("batch_id");

-- ============================================
-- PASO 7: Agregar Foreign Keys
-- ============================================

-- equipment_models
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_type_id_fkey" 
  FOREIGN KEY ("type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- equipment_batches
ALTER TABLE "equipment_batches" ADD CONSTRAINT "equipment_batches_model_id_fkey" 
  FOREIGN KEY ("model_id") REFERENCES "equipment_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipment_batches" ADD CONSTRAINT "equipment_batches_supplier_id_fkey" 
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipment_batches" ADD CONSTRAINT "equipment_batches_warehouse_id_fkey" 
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipment_batches" ADD CONSTRAINT "equipment_batches_received_by_fkey" 
  FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- equipment
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_model_id_fkey" 
  FOREIGN KEY ("model_id") REFERENCES "equipment_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
