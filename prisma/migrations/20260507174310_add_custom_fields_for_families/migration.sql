-- CreateTable
CREATE TABLE "family_custom_fields" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "field_name" VARCHAR(50) NOT NULL,
    "field_label" VARCHAR(100) NOT NULL,
    "field_type" VARCHAR(20) NOT NULL,
    "field_options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "help_text" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_custom_values" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "field_name" VARCHAR(50) NOT NULL,
    "field_value" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_custom_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "family_custom_fields_family_id_order_idx" ON "family_custom_fields"("family_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "family_custom_fields_family_id_field_name_key" ON "family_custom_fields"("family_id", "field_name");

-- CreateIndex
CREATE INDEX "equipment_custom_values_equipment_id_idx" ON "equipment_custom_values"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_custom_values_field_name_field_value_idx" ON "equipment_custom_values"("field_name", "field_value");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_custom_values_equipment_id_field_name_key" ON "equipment_custom_values"("equipment_id", "field_name");

-- AddForeignKey
ALTER TABLE "family_custom_fields" ADD CONSTRAINT "family_custom_fields_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_custom_values" ADD CONSTRAINT "equipment_custom_values_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
