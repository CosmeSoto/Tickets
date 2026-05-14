-- Migración: constraint única en patrols(schedule_id, scheduled_start)
-- Garantiza que no se generen patrullas duplicadas para el mismo schedule y fecha/hora.
-- Esto hace que createMany({ skipDuplicates: true }) funcione correctamente
-- en PatrolSchedulerService.generatePatrols() y regenerateActiveSchedules().

-- Eliminar duplicados existentes antes de crear la constraint
-- (conserva el registro con el id más pequeño por cada par schedule_id+scheduled_start)
DELETE FROM "patrols"
WHERE id NOT IN (
  SELECT MIN(id)
  FROM "patrols"
  WHERE "schedule_id" IS NOT NULL
  GROUP BY "schedule_id", "scheduled_start"
)
AND "schedule_id" IS NOT NULL;

-- Crear el índice único
CREATE UNIQUE INDEX "patrol_schedule_start_unique"
  ON "patrols"("schedule_id", "scheduled_start")
  WHERE "schedule_id" IS NOT NULL;
