-- Acceso unificado a áreas por módulo (extensible vía module string)
CREATE TABLE IF NOT EXISTS "user_family_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "can_consume" BOOLEAN NOT NULL DEFAULT false,
    "can_operate" BOOLEAN NOT NULL DEFAULT false,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_family_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_family_access_user_id_family_id_module_key"
  ON "user_family_access"("user_id", "family_id", "module");

CREATE INDEX IF NOT EXISTS "user_family_access_user_id_module_is_active_idx"
  ON "user_family_access"("user_id", "module", "is_active");

CREATE INDEX IF NOT EXISTS "user_family_access_family_id_module_is_active_idx"
  ON "user_family_access"("family_id", "module", "is_active");

CREATE INDEX IF NOT EXISTS "user_family_access_module_is_active_idx"
  ON "user_family_access"("module", "is_active");

DO $$ BEGIN
  ALTER TABLE "user_family_access"
    ADD CONSTRAINT "user_family_access_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_family_access"
    ADD CONSTRAINT "user_family_access_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
