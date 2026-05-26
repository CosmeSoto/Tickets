-- ============================================
-- PASO 1: Crear tabla equipment_brands
-- ============================================

CREATE TABLE "equipment_brands" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "family_id" TEXT,

    CONSTRAINT "equipment_brands_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- PASO 2: Modificar tabla equipment_models
-- ============================================

-- Agregar columna brand_id (nullable temporalmente)
ALTER TABLE "equipment_models" ADD COLUMN "brand_id" TEXT;

-- ============================================
-- PASO 3: Crear índices
-- ============================================

CREATE UNIQUE INDEX "equipment_brands_code_key" ON "equipment_brands"("code");
CREATE INDEX "equipment_brands_is_active_order_idx" ON "equipment_brands"("is_active", "order");
CREATE INDEX "equipment_brands_family_id_idx" ON "equipment_brands"("family_id");
CREATE INDEX "equipment_models_brand_id_idx" ON "equipment_models"("brand_id");

-- ============================================
-- PASO 4: Agregar Foreign Keys
-- ============================================

ALTER TABLE "equipment_brands" ADD CONSTRAINT "equipment_brands_family_id_fkey" 
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_brand_id_fkey" 
  FOREIGN KEY ("brand_id") REFERENCES "equipment_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

