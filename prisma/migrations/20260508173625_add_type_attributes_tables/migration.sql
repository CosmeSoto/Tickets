-- CreateTable
CREATE TABLE "equipment_type_attributes" (
    "id" TEXT NOT NULL,
    "equipment_type_id" TEXT NOT NULL,
    "attribute_name" VARCHAR(100) NOT NULL,
    "attribute_label" VARCHAR(200) NOT NULL,
    "attribute_type" VARCHAR(20) NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "help_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_type_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_type_attributes" (
    "id" TEXT NOT NULL,
    "license_type_id" TEXT NOT NULL,
    "attribute_name" VARCHAR(100) NOT NULL,
    "attribute_label" VARCHAR(200) NOT NULL,
    "attribute_type" VARCHAR(20) NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "help_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_type_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_type_attributes" (
    "id" TEXT NOT NULL,
    "consumable_type_id" TEXT NOT NULL,
    "attribute_name" VARCHAR(100) NOT NULL,
    "attribute_label" VARCHAR(200) NOT NULL,
    "attribute_type" VARCHAR(20) NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "help_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumable_type_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_type_attributes_equipment_type_id_order_idx" ON "equipment_type_attributes"("equipment_type_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_type_attributes_equipment_type_id_attribute_name_key" ON "equipment_type_attributes"("equipment_type_id", "attribute_name");

-- CreateIndex
CREATE INDEX "license_type_attributes_license_type_id_order_idx" ON "license_type_attributes"("license_type_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "license_type_attributes_license_type_id_attribute_name_key" ON "license_type_attributes"("license_type_id", "attribute_name");

-- CreateIndex
CREATE INDEX "consumable_type_attributes_consumable_type_id_order_idx" ON "consumable_type_attributes"("consumable_type_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "consumable_type_attributes_consumable_type_id_attribute_nam_key" ON "consumable_type_attributes"("consumable_type_id", "attribute_name");

-- AddForeignKey
ALTER TABLE "equipment_type_attributes" ADD CONSTRAINT "equipment_type_attributes_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_type_attributes" ADD CONSTRAINT "license_type_attributes_license_type_id_fkey" FOREIGN KEY ("license_type_id") REFERENCES "license_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_type_attributes" ADD CONSTRAINT "consumable_type_attributes_consumable_type_id_fkey" FOREIGN KEY ("consumable_type_id") REFERENCES "consumable_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
