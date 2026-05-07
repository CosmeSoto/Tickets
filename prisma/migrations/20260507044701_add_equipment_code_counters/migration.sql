/*
  Warnings:

  - You are about to drop the column `type` on the `suppliers` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssetRequestStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('EQUIPMENT', 'LICENSE', 'OTHER');

-- AlterEnum
ALTER TYPE "EquipmentStatus" ADD VALUE 'SOLD';

-- DropIndex
DROP INDEX "suppliers_type_is_active_idx";

-- AlterTable
ALTER TABLE "client_family_assignments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contract_attachments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contract_lines" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contracts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "type",
ADD COLUMN     "family_id" TEXT,
ADD COLUMN     "type_id" TEXT;

-- AlterTable
ALTER TABLE "system_modules" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ticket_family_config" ADD COLUMN     "allowed_from_families" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "can_request_assets" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "family_id" TEXT;

-- DropEnum
DROP TYPE "SupplierType";

-- CreateTable
CREATE TABLE "equipment_code_counters" (
    "id" TEXT NOT NULL,
    "counter_key" VARCHAR(100) NOT NULL,
    "family_code" VARCHAR(10) NOT NULL,
    "type_code" VARCHAR(10) NOT NULL,
    "ownership_mode" VARCHAR(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_code_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_types" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "family_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 999,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_sales" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "buyer_name" VARCHAR(200) NOT NULL,
    "buyer_company" VARCHAR(200),
    "buyer_id_number" VARCHAR(50),
    "sale_price" DOUBLE PRECISION NOT NULL,
    "sale_date" TIMESTAMP(3) NOT NULL,
    "invoice_number" VARCHAR(100),
    "payment_method" VARCHAR(50),
    "accessories" TEXT[],
    "notes" TEXT,
    "rejection_reason" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_requests" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "asset_type" "AssetType" NOT NULL,
    "description" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "needed_by" TIMESTAMP(3),
    "asset_id" TEXT,
    "asset_entity_type" VARCHAR(20),
    "family_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "status" "AssetRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_comment" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "fulfilled_by_id" TEXT,
    "fulfilled_at" TIMESTAMP(3),
    "review_comments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_counters_counter_key_key" ON "equipment_code_counters"("counter_key");

-- CreateIndex
CREATE INDEX "equipment_code_counters_family_code_type_code_year_idx" ON "equipment_code_counters"("family_code", "type_code", "year");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_types_code_key" ON "supplier_types"("code");

-- CreateIndex
CREATE INDEX "supplier_types_is_active_order_idx" ON "supplier_types"("is_active", "order");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_sales_equipment_id_key" ON "equipment_sales"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_sales_status_created_at_idx" ON "equipment_sales"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "equipment_sales_requested_by_id_idx" ON "equipment_sales"("requested_by_id");

-- CreateIndex
CREATE INDEX "equipment_sales_approved_by_id_idx" ON "equipment_sales"("approved_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_requests_code_key" ON "asset_requests"("code");

-- CreateIndex
CREATE INDEX "asset_requests_family_id_status_created_at_idx" ON "asset_requests"("family_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "asset_requests_requester_id_created_at_idx" ON "asset_requests"("requester_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "asset_requests_status_created_at_idx" ON "asset_requests"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "asset_requests_code_idx" ON "asset_requests"("code");

-- CreateIndex
CREATE INDEX "asset_requests_family_id_created_at_idx" ON "asset_requests"("family_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "asset_requests_reviewed_by_id_idx" ON "asset_requests"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "asset_requests_fulfilled_by_id_idx" ON "asset_requests"("fulfilled_by_id");

-- CreateIndex
CREATE INDEX "equipment_status_created_at_idx" ON "equipment"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "equipment_department_id_status_idx" ON "equipment"("department_id", "status");

-- CreateIndex
CREATE INDEX "equipment_created_at_idx" ON "equipment"("created_at" DESC);

-- CreateIndex
CREATE INDEX "equipment_supplier_id_idx" ON "equipment"("supplier_id");

-- CreateIndex
CREATE INDEX "equipment_warehouse_id_idx" ON "equipment"("warehouse_id");

-- CreateIndex
CREATE INDEX "suppliers_type_id_is_active_idx" ON "suppliers"("type_id", "is_active");

-- CreateIndex
CREATE INDEX "suppliers_family_id_is_active_idx" ON "suppliers"("family_id", "is_active");

-- CreateIndex
CREATE INDEX "warehouses_family_id_is_active_idx" ON "warehouses"("family_id", "is_active");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "supplier_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_types" ADD CONSTRAINT "supplier_types_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_sales" ADD CONSTRAINT "equipment_sales_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_sales" ADD CONSTRAINT "equipment_sales_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_sales" ADD CONSTRAINT "equipment_sales_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_fulfilled_by_id_fkey" FOREIGN KEY ("fulfilled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "maintenance_records_equipmentId_status_idx" RENAME TO "maintenance_records_equipment_id_status_idx";
