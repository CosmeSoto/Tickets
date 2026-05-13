-- Módulo de patrullas: enums, tablas y columnas enlazadas.
-- Sin esta migración, Prisma falla al consultar `patrol_family_config` (500 en /api/patrols/family-config).

-- ── Extender enums existentes ───────────────────────────────────────────────
ALTER TYPE "TicketSource" ADD VALUE 'PATROL';

ALTER TYPE "NotificationType" ADD VALUE 'PATROL_MISSED';
ALTER TYPE "NotificationType" ADD VALUE 'PATROL_INCOMPLETE';
ALTER TYPE "NotificationType" ADD VALUE 'PATROL_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'OFFLINE_SYNC_REJECTED';

-- ── Usuarios: flag de módulo ─────────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "patrols_enabled" BOOLEAN NOT NULL DEFAULT false;

-- ── Enums del módulo patrol ───────────────────────────────────────────────────
CREATE TYPE "PatrolStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'INCOMPLETE');
CREATE TYPE "QRType" AS ENUM ('DYNAMIC', 'STATIC');
CREATE TYPE "CheckInValidationResult" AS ENUM ('VALID', 'QR_TOKEN_INVALID', 'GPS_OUT_OF_GEOFENCE', 'OFFLINE_SYNC_REJECTED');
CREATE TYPE "CheckInMethod" AS ENUM ('QR_DYNAMIC', 'QR_STATIC', 'OFFLINE_SYNC');
CREATE TYPE "PatrolRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'CUSTOM');

-- Fotos: se crea primero sin FKs a patrulla/check-in (se añaden al final).
CREATE TABLE "patrol_photos" (
    "id" TEXT NOT NULL,
    "check_in_id" TEXT,
    "patrol_id" TEXT,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patrol_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patrol_family_config" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "patrols_enabled" BOOLEAN NOT NULL DEFAULT true,
    "qr_window_minutes" INTEGER NOT NULL DEFAULT 5,
    "geofence_radius_meters" INTEGER NOT NULL DEFAULT 50,
    "photo_retention_days" INTEGER NOT NULL DEFAULT 90,
    "photo_compression_quality" DOUBLE PRECISION NOT NULL DEFAULT 0.82,
    "photo_max_width_px" INTEGER NOT NULL DEFAULT 1280,
    "require_photo_on_start" BOOLEAN NOT NULL DEFAULT false,
    "require_photo_on_end" BOOLEAN NOT NULL DEFAULT false,
    "offline_sync_tolerance_minutes" INTEGER NOT NULL DEFAULT 30,
    "alert_completion_threshold" INTEGER NOT NULL DEFAULT 80,
    "grace_period_minutes" INTEGER NOT NULL DEFAULT 15,
    "patrol_incident_category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrol_family_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patrol_checkpoints" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(500) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geofence_radius_meters" INTEGER,
    "has_connectivity" BOOLEAN NOT NULL DEFAULT true,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "qr_type" "QRType" NOT NULL DEFAULT 'DYNAMIC',
    "qr_secret" TEXT NOT NULL,
    "qr_static_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrol_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patrol_routes" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "estimated_duration_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrol_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patrol_route_checkpoints" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "checkpoint_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patrol_route_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patrol_schedules" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "recurrence" "PatrolRecurrence" NOT NULL DEFAULT 'NONE',
    "recurrence_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrol_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patrols" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "route_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "status" "PatrolStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completion_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "missed_checkpoint_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "start_photo_id" TEXT,
    "end_photo_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrols_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patrol_check_ins" (
    "id" TEXT NOT NULL,
    "patrol_id" TEXT NOT NULL,
    "checkpoint_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "submitted_token_hash" TEXT NOT NULL,
    "gps_lat" DOUBLE PRECISION,
    "gps_lng" DOUBLE PRECISION,
    "gps_accuracy_meters" DOUBLE PRECISION,
    "distance_from_checkpoint_meters" DOUBLE PRECISION,
    "validation_result" "CheckInValidationResult" NOT NULL,
    "method" "CheckInMethod" NOT NULL,
    "device_timestamp" TIMESTAMP(3) NOT NULL,
    "server_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    "is_offline" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patrol_check_ins_pkey" PRIMARY KEY ("id")
);

-- ── Índices y unicidad ───────────────────────────────────────────────────────
CREATE UNIQUE INDEX "patrol_family_config_family_id_key" ON "patrol_family_config"("family_id");
CREATE INDEX "patrol_family_config_family_id_idx" ON "patrol_family_config"("family_id");

CREATE INDEX "patrol_checkpoints_family_id_is_active_idx" ON "patrol_checkpoints"("family_id", "is_active");
CREATE INDEX "patrol_checkpoints_qr_type_is_active_idx" ON "patrol_checkpoints"("qr_type", "is_active");

CREATE INDEX "patrol_routes_family_id_is_active_idx" ON "patrol_routes"("family_id", "is_active");

CREATE UNIQUE INDEX "patrol_route_checkpoints_route_id_checkpoint_id_key" ON "patrol_route_checkpoints"("route_id", "checkpoint_id");
CREATE UNIQUE INDEX "patrol_route_checkpoints_route_id_order_key" ON "patrol_route_checkpoints"("route_id", "order");
CREATE INDEX "patrol_route_checkpoints_route_id_order_idx" ON "patrol_route_checkpoints"("route_id", "order");
CREATE INDEX "patrol_route_checkpoints_checkpoint_id_idx" ON "patrol_route_checkpoints"("checkpoint_id");

CREATE INDEX "patrol_schedules_agent_id_is_active_idx" ON "patrol_schedules"("agent_id", "is_active");
CREATE INDEX "patrol_schedules_family_id_is_active_idx" ON "patrol_schedules"("family_id", "is_active");
CREATE INDEX "patrol_schedules_route_id_is_active_idx" ON "patrol_schedules"("route_id", "is_active");

CREATE INDEX "patrols_agent_id_status_idx" ON "patrols"("agent_id", "status");
CREATE INDEX "patrols_family_id_scheduled_start_idx" ON "patrols"("family_id", "scheduled_start");
CREATE INDEX "patrols_status_scheduled_start_idx" ON "patrols"("status", "scheduled_start");
CREATE INDEX "patrols_schedule_id_status_idx" ON "patrols"("schedule_id", "status");

CREATE INDEX "patrol_check_ins_patrol_id_checkpoint_id_idx" ON "patrol_check_ins"("patrol_id", "checkpoint_id");
CREATE INDEX "patrol_check_ins_patrol_id_created_at_idx" ON "patrol_check_ins"("patrol_id", "created_at" DESC);
CREATE INDEX "patrol_check_ins_checkpoint_id_validation_result_idx" ON "patrol_check_ins"("checkpoint_id", "validation_result");

CREATE INDEX "patrol_photos_check_in_id_idx" ON "patrol_photos"("check_in_id");
CREATE INDEX "patrol_photos_patrol_id_idx" ON "patrol_photos"("patrol_id");
CREATE INDEX "patrol_photos_captured_at_idx" ON "patrol_photos"("captured_at" DESC);
CREATE INDEX "patrol_photos_deleted_at_idx" ON "patrol_photos"("deleted_at");

-- ── Foreign keys ─────────────────────────────────────────────────────────────
ALTER TABLE "patrol_family_config" ADD CONSTRAINT "patrol_family_config_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patrol_family_config" ADD CONSTRAINT "patrol_family_config_patrol_incident_category_id_fkey"
  FOREIGN KEY ("patrol_incident_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patrol_checkpoints" ADD CONSTRAINT "patrol_checkpoints_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patrol_routes" ADD CONSTRAINT "patrol_routes_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patrol_route_checkpoints" ADD CONSTRAINT "patrol_route_checkpoints_route_id_fkey"
  FOREIGN KEY ("route_id") REFERENCES "patrol_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patrol_route_checkpoints" ADD CONSTRAINT "patrol_route_checkpoints_checkpoint_id_fkey"
  FOREIGN KEY ("checkpoint_id") REFERENCES "patrol_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patrol_schedules" ADD CONSTRAINT "patrol_schedules_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patrol_schedules" ADD CONSTRAINT "patrol_schedules_route_id_fkey"
  FOREIGN KEY ("route_id") REFERENCES "patrol_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patrol_schedules" ADD CONSTRAINT "patrol_schedules_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patrols" ADD CONSTRAINT "patrols_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patrols" ADD CONSTRAINT "patrols_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "patrol_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patrols" ADD CONSTRAINT "patrols_route_id_fkey"
  FOREIGN KEY ("route_id") REFERENCES "patrol_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patrols" ADD CONSTRAINT "patrols_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patrols" ADD CONSTRAINT "patrols_start_photo_id_fkey"
  FOREIGN KEY ("start_photo_id") REFERENCES "patrol_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patrols" ADD CONSTRAINT "patrols_end_photo_id_fkey"
  FOREIGN KEY ("end_photo_id") REFERENCES "patrol_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patrol_check_ins" ADD CONSTRAINT "patrol_check_ins_patrol_id_fkey"
  FOREIGN KEY ("patrol_id") REFERENCES "patrols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patrol_check_ins" ADD CONSTRAINT "patrol_check_ins_checkpoint_id_fkey"
  FOREIGN KEY ("checkpoint_id") REFERENCES "patrol_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patrol_check_ins" ADD CONSTRAINT "patrol_check_ins_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patrol_photos" ADD CONSTRAINT "patrol_photos_check_in_id_fkey"
  FOREIGN KEY ("check_in_id") REFERENCES "patrol_check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patrol_photos" ADD CONSTRAINT "patrol_photos_patrol_id_fkey"
  FOREIGN KEY ("patrol_id") REFERENCES "patrols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tickets ↔ check-in de patrulla
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "check_in_id" TEXT;
CREATE INDEX IF NOT EXISTS "tickets_check_in_id_idx" ON "tickets"("check_in_id");
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_check_in_id_fkey";
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_check_in_id_fkey"
  FOREIGN KEY ("check_in_id") REFERENCES "patrol_check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
