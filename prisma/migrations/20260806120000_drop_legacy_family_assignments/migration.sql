-- Migración final: copiar asignaciones legacy → user_family_access y eliminar tablas antiguas.
-- Seguro si user_family_access ya existe o si alguna tabla legacy ya no está.

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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

DO $$
BEGIN
  IF to_regclass('public.user_family_access') IS NOT NULL
     AND to_regclass('public.technician_family_assignments') IS NOT NULL THEN
    INSERT INTO "user_family_access" (
      "id", "user_id", "family_id", "module",
      "can_consume", "can_operate", "can_view", "is_active", "created_at", "updated_at"
    )
    SELECT
      gen_random_uuid()::text,
      t."technician_id",
      t."family_id",
      'tickets',
      true, false, false,
      COALESCE(t."is_active", true),
      COALESCE(t."created_at", NOW()),
      NOW()
    FROM "technician_family_assignments" t
    WHERE EXISTS (SELECT 1 FROM "users" u WHERE u.id = t."technician_id")
      AND EXISTS (SELECT 1 FROM "families" f WHERE f.id = t."family_id")
    ON CONFLICT ("user_id", "family_id", "module") DO NOTHING;
  END IF;

  IF to_regclass('public.user_family_access') IS NOT NULL
     AND to_regclass('public.admin_family_assignments') IS NOT NULL THEN
    INSERT INTO "user_family_access" (
      "id", "user_id", "family_id", "module",
      "can_consume", "can_operate", "can_view", "is_active", "created_at", "updated_at"
    )
    SELECT
      gen_random_uuid()::text,
      a."admin_id",
      a."family_id",
      'tickets',
      true, false, false,
      COALESCE(a."is_active", true),
      COALESCE(a."created_at", NOW()),
      NOW()
    FROM "admin_family_assignments" a
    WHERE EXISTS (SELECT 1 FROM "users" u WHERE u.id = a."admin_id")
      AND EXISTS (SELECT 1 FROM "families" f WHERE f.id = a."family_id")
    ON CONFLICT ("user_id", "family_id", "module") DO NOTHING;
  END IF;

  IF to_regclass('public.user_family_access') IS NOT NULL
     AND to_regclass('public.client_family_assignments') IS NOT NULL THEN
    INSERT INTO "user_family_access" (
      "id", "user_id", "family_id", "module",
      "can_consume", "can_operate", "can_view", "is_active", "created_at", "updated_at"
    )
    SELECT
      gen_random_uuid()::text,
      c."client_id",
      c."family_id",
      'tickets',
      true, false, true,
      COALESCE(c."is_active", true),
      COALESCE(c."created_at", NOW()),
      NOW()
    FROM "client_family_assignments" c
    WHERE EXISTS (SELECT 1 FROM "users" u WHERE u.id = c."client_id")
      AND EXISTS (SELECT 1 FROM "families" f WHERE f.id = c."family_id")
    ON CONFLICT ("user_id", "family_id", "module") DO NOTHING;
  END IF;

  IF to_regclass('public.user_family_access') IS NOT NULL
     AND to_regclass('public.inventory_manager_families') IS NOT NULL THEN
    INSERT INTO "user_family_access" (
      "id", "user_id", "family_id", "module",
      "can_consume", "can_operate", "can_view", "is_active", "created_at", "updated_at"
    )
    SELECT
      gen_random_uuid()::text,
      i."manager_id",
      i."family_id",
      'inventory',
      false, true, true,
      true,
      COALESCE(i."created_at", NOW()),
      NOW()
    FROM "inventory_manager_families" i
    WHERE EXISTS (SELECT 1 FROM "users" u WHERE u.id = i."manager_id")
      AND EXISTS (SELECT 1 FROM "families" f WHERE f.id = i."family_id")
    ON CONFLICT ("user_id", "family_id", "module") DO NOTHING;
  END IF;

  IF to_regclass('public.user_family_access') IS NOT NULL
     AND to_regclass('public.patrol_family_assignments') IS NOT NULL THEN
    INSERT INTO "user_family_access" (
      "id", "user_id", "family_id", "module",
      "can_consume", "can_operate", "can_view", "is_active", "created_at", "updated_at"
    )
    SELECT
      gen_random_uuid()::text,
      p."user_id",
      p."family_id",
      'patrols',
      false, true, true,
      COALESCE(p."is_active", true),
      COALESCE(p."created_at", NOW()),
      NOW()
    FROM "patrol_family_assignments" p
    WHERE EXISTS (SELECT 1 FROM "users" u WHERE u.id = p."user_id")
      AND EXISTS (SELECT 1 FROM "families" f WHERE f.id = p."family_id")
    ON CONFLICT ("user_id", "family_id", "module") DO NOTHING;
  END IF;
END $$;

-- Content: semilla desde tickets (solo si el usuario aún no tiene grants content)
INSERT INTO "user_family_access" (
  "id", "user_id", "family_id", "module",
  "can_consume", "can_operate", "can_view", "is_active", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  ufa."user_id",
  ufa."family_id",
  'content',
  false, true, true,
  ufa."is_active",
  NOW(),
  NOW()
FROM "user_family_access" ufa
WHERE ufa."module" = 'tickets'
  AND ufa."is_active" = true
  AND NOT EXISTS (
    SELECT 1 FROM "user_family_access" x
    WHERE x."user_id" = ufa."user_id" AND x."module" = 'content'
  )
ON CONFLICT ("user_id", "family_id", "module") DO NOTHING;

-- Drop legacy
DROP TABLE IF EXISTS "technician_family_assignments" CASCADE;
DROP TABLE IF EXISTS "client_family_assignments" CASCADE;
DROP TABLE IF EXISTS "admin_family_assignments" CASCADE;
DROP TABLE IF EXISTS "inventory_manager_families" CASCADE;
DROP TABLE IF EXISTS "patrol_family_assignments" CASCADE;
