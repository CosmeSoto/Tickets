-- Add client_family_assignments table
-- Allows explicit assignment of families to CLIENT users for ticket access
-- beyond their department's native family.
-- Mirrors the pattern of technician_family_assignments.

CREATE TABLE "client_family_assignments" (
  "id"         TEXT NOT NULL,
  "client_id"  TEXT NOT NULL,
  "family_id"  TEXT NOT NULL,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_family_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_family_assignments_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_family_assignments_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_family_assignments_client_id_family_id_key"
    UNIQUE ("client_id", "family_id")
);

CREATE INDEX "client_family_assignments_client_id_is_active_idx"
  ON "client_family_assignments"("client_id", "is_active");

CREATE INDEX "client_family_assignments_family_id_is_active_idx"
  ON "client_family_assignments"("family_id", "is_active");
