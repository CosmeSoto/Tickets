-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('LAPTOP', 'DESKTOP', 'MONITOR', 'PRINTER', 'PHONE', 'TABLET', 'KEYBOARD', 'MOUSE', 'HEADSET', 'WEBCAM', 'DOCKING_STATION', 'UPS', 'ROUTER', 'SWITCH', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'DAMAGED', 'RETIRED');

-- CreateEnum
CREATE TYPE "EquipmentCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('FIXED_ASSET', 'RENTAL', 'LOAN');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PERMANENT', 'TEMPORARY', 'LOAN');

-- CreateEnum
CREATE TYPE "ActStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('WINDOWS', 'OFFICE', 'ANTIVIRUS', 'ADOBE', 'AUTOCAD', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsumableType" AS ENUM ('TONER', 'INK', 'PAPER', 'CABLE', 'BATTERY', 'CLEANING', 'OTHER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "EquipmentType" NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "EquipmentCondition" NOT NULL DEFAULT 'GOOD',
    "ownership_type" "OwnershipType" NOT NULL DEFAULT 'FIXED_ASSET',
    "purchase_date" TIMESTAMP(3),
    "purchase_price" DOUBLE PRECISION,
    "warranty_expiration" TIMESTAMP(3),
    "specifications" JSONB,
    "accessories" TEXT[],
    "location" TEXT,
    "notes" TEXT,
    "photo_url" TEXT,
    "qr_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_assignments" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "deliverer_id" TEXT NOT NULL,
    "assignment_type" "AssignmentType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "actual_end_date" TIMESTAMP(3),
    "accessories" TEXT[],
    "observations" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_acts" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "equipment_snapshot" JSONB NOT NULL,
    "deliverer_info" JSONB NOT NULL,
    "receiver_info" JSONB NOT NULL,
    "accessories" TEXT[],
    "observations" TEXT,
    "terms_version" TEXT NOT NULL DEFAULT '1.0',
    "status" "ActStatus" NOT NULL DEFAULT 'PENDING',
    "acceptance_token" TEXT NOT NULL,
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "signature_timestamp" TIMESTAMP(3),
    "signature_ip" TEXT,
    "signature_user_agent" TEXT,
    "verification_hash" TEXT,
    "pdf_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_acts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_acts" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "delivery_act_id" TEXT NOT NULL,
    "equipment_condition" "EquipmentCondition" NOT NULL,
    "inspection_notes" TEXT,
    "return_date" TIMESTAMP(3) NOT NULL,
    "receiver_info" JSONB NOT NULL,
    "deliverer_info" JSONB NOT NULL,
    "status" "ActStatus" NOT NULL DEFAULT 'PENDING',
    "acceptance_token" TEXT NOT NULL,
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "signature_timestamp" TIMESTAMP(3),
    "signature_ip" TEXT,
    "signature_user_agent" TEXT,
    "verification_hash" TEXT,
    "pdf_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_acts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "parts_replaced" TEXT[],
    "ticket_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software_licenses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LicenseType" NOT NULL,
    "key" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "vendor" TEXT,
    "assigned_to_equipment" TEXT,
    "assigned_to_user" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "software_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConsumableType" NOT NULL,
    "unit_of_measure" TEXT NOT NULL,
    "current_stock" DOUBLE PRECISION NOT NULL,
    "min_stock" DOUBLE PRECISION NOT NULL,
    "max_stock" DOUBLE PRECISION NOT NULL,
    "cost_per_unit" DOUBLE PRECISION,
    "compatible_equipment" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "consumable_id" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_counters" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "folio_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_qr_code_key" ON "equipment"("qr_code");

-- CreateIndex
CREATE INDEX "equipment_code_idx" ON "equipment"("code");

-- CreateIndex
CREATE INDEX "equipment_serial_number_idx" ON "equipment"("serial_number");

-- CreateIndex
CREATE INDEX "equipment_type_status_idx" ON "equipment"("type", "status");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_assignments_equipment_id_is_active_idx" ON "equipment_assignments"("equipment_id", "is_active");

-- CreateIndex
CREATE INDEX "equipment_assignments_receiver_id_is_active_idx" ON "equipment_assignments"("receiver_id", "is_active");

-- CreateIndex
CREATE INDEX "equipment_assignments_deliverer_id_idx" ON "equipment_assignments"("deliverer_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_acts_folio_key" ON "delivery_acts"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_acts_assignment_id_key" ON "delivery_acts"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_acts_acceptance_token_key" ON "delivery_acts"("acceptance_token");

-- CreateIndex
CREATE INDEX "delivery_acts_folio_idx" ON "delivery_acts"("folio");

-- CreateIndex
CREATE INDEX "delivery_acts_status_expiration_date_idx" ON "delivery_acts"("status", "expiration_date");

-- CreateIndex
CREATE INDEX "delivery_acts_acceptance_token_idx" ON "delivery_acts"("acceptance_token");

-- CreateIndex
CREATE UNIQUE INDEX "return_acts_folio_key" ON "return_acts"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "return_acts_assignment_id_key" ON "return_acts"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_acts_acceptance_token_key" ON "return_acts"("acceptance_token");

-- CreateIndex
CREATE INDEX "return_acts_folio_idx" ON "return_acts"("folio");

-- CreateIndex
CREATE INDEX "return_acts_status_expiration_date_idx" ON "return_acts"("status", "expiration_date");

-- CreateIndex
CREATE INDEX "return_acts_acceptance_token_idx" ON "return_acts"("acceptance_token");

-- CreateIndex
CREATE INDEX "maintenance_records_equipment_id_date_idx" ON "maintenance_records"("equipment_id", "date");

-- CreateIndex
CREATE INDEX "maintenance_records_technician_id_idx" ON "maintenance_records"("technician_id");

-- CreateIndex
CREATE INDEX "maintenance_records_ticket_id_idx" ON "maintenance_records"("ticket_id");

-- CreateIndex
CREATE INDEX "software_licenses_type_expiration_date_idx" ON "software_licenses"("type", "expiration_date");

-- CreateIndex
CREATE INDEX "software_licenses_assigned_to_equipment_idx" ON "software_licenses"("assigned_to_equipment");

-- CreateIndex
CREATE INDEX "software_licenses_assigned_to_user_idx" ON "software_licenses"("assigned_to_user");

-- CreateIndex
CREATE INDEX "consumables_type_current_stock_idx" ON "consumables"("type", "current_stock");

-- CreateIndex
CREATE INDEX "stock_movements_consumable_id_created_at_idx" ON "stock_movements"("consumable_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_user_id_idx" ON "stock_movements"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "folio_counters_year_type_key" ON "folio_counters"("year", "type");

-- AddForeignKey
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_deliverer_id_fkey" FOREIGN KEY ("deliverer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_acts" ADD CONSTRAINT "delivery_acts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "equipment_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_acts" ADD CONSTRAINT "return_acts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "equipment_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_assigned_to_equipment_fkey" FOREIGN KEY ("assigned_to_equipment") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_assigned_to_user_fkey" FOREIGN KEY ("assigned_to_user") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
