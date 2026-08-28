-- Da a las licencias el mismo nivel de trazabilidad que ya tienen equipos y
-- contratos/suscripciones: historial de asignaciones con quién entregó, quién
-- recibió y cuándo, en vez del PATCH directo y sin rastro que existía antes
-- sobre software_licenses.assignedToUser/assignedToEquipment/assignedToDepartment
-- (esas columnas se conservan como estado "actual" desnormalizado — el historial
-- vive en la tabla nueva).

-- AlterEnum
ALTER TYPE "DeliveryActType" ADD VALUE IF NOT EXISTS 'LICENSE_ASSIGNMENT';

-- CreateTable
CREATE TABLE "license_assignments" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "deliverer_id" TEXT NOT NULL,
    "scope" "LicenseScope" NOT NULL,
    "receiver_user_id" TEXT,
    "department_id" TEXT,
    "equipment_id" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actual_end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "change_reason" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "license_assignments_license_id_is_active_idx" ON "license_assignments"("license_id", "is_active");

-- CreateIndex
CREATE INDEX "license_assignments_receiver_user_id_is_active_idx" ON "license_assignments"("receiver_user_id", "is_active");

-- AddForeignKey
ALTER TABLE "license_assignments" ADD CONSTRAINT "license_assignments_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "software_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_assignments" ADD CONSTRAINT "license_assignments_deliverer_id_fkey" FOREIGN KEY ("deliverer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_assignments" ADD CONSTRAINT "license_assignments_receiver_user_id_fkey" FOREIGN KEY ("receiver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_assignments" ADD CONSTRAINT "license_assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_assignments" ADD CONSTRAINT "license_assignments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "delivery_acts" ADD COLUMN "license_assignment_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "delivery_acts_license_assignment_id_key" ON "delivery_acts"("license_assignment_id");

-- AddForeignKey
ALTER TABLE "delivery_acts" ADD CONSTRAINT "delivery_acts_license_assignment_id_fkey" FOREIGN KEY ("license_assignment_id") REFERENCES "license_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
