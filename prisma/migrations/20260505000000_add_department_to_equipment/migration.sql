-- Add department_id to equipment table (idempotent)
-- departmentId is set when equipment is ASSIGNED to a user,
-- derived from the receiving user's department for fast filtering and reporting.
-- It is nullable: available/maintenance equipment may not have a department.
-- Uses IF NOT EXISTS so this is safe to run on fresh builds where init already includes it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE "equipment" ADD COLUMN "department_id" TEXT;

    ALTER TABLE "equipment"
      ADD CONSTRAINT "equipment_department_id_fkey"
      FOREIGN KEY ("department_id")
      REFERENCES "departments"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;

    CREATE INDEX "equipment_department_id_idx" ON "equipment"("department_id");

    -- Backfill: set department_id from the active assignment's receiver's department
    UPDATE "equipment" e
    SET "department_id" = u."departmentId"
    FROM "equipment_assignments" ea
    JOIN "users" u ON u.id = ea."receiver_id"
    WHERE ea."equipment_id" = e.id
      AND ea."is_active" = true
      AND u."departmentId" IS NOT NULL;
  END IF;
END $$;
