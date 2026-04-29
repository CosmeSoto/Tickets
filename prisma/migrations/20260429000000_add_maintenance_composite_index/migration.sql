-- Performance optimization: composite index for maintenance_records
-- Speeds up client dashboard query: WHERE equipmentId IN (...) AND status IN ('REQUESTED', 'SCHEDULED', 'ACCEPTED')
CREATE INDEX IF NOT EXISTS "maintenance_records_equipmentId_status_idx"
  ON "maintenance_records" ("equipment_id", "status");
