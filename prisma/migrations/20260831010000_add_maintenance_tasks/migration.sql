-- Checklist de pasos marcables dentro de un mantenimiento (ej. "Limpieza",
-- "Cambio de pasta térmica", "Prueba final") — puramente organizativo, no
-- condiciona el flujo de estados (REQUESTED/SCHEDULED/ACCEPTED/COMPLETED)
-- del mantenimiento en sí.

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" TEXT NOT NULL,
    "maintenance_record_id" TEXT NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "order" INTEGER NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_tasks_maintenance_record_id_order_key" ON "maintenance_tasks"("maintenance_record_id", "order");

-- CreateIndex
CREATE INDEX "maintenance_tasks_maintenance_record_id_order_idx" ON "maintenance_tasks"("maintenance_record_id", "order");

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_maintenance_record_id_fkey" FOREIGN KEY ("maintenance_record_id") REFERENCES "maintenance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
