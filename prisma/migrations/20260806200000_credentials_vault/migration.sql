-- Credentials / Vault MVP (idempotente)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "credentials_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "can_manage_credentials" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "CredentialVaultKind" AS ENUM ('AREA', 'PERSONAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CredentialShareCapability" AS ENUM ('VIEW', 'USE', 'EDIT', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "credential_vaults" (
    "id" TEXT NOT NULL,
    "family_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_user_id" TEXT,
    "kind" "CredentialVaultKind" NOT NULL DEFAULT 'AREA',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credential_vaults_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "credential_vaults_family_id_is_active_idx"
  ON "credential_vaults"("family_id", "is_active");
CREATE INDEX IF NOT EXISTS "credential_vaults_owner_user_id_idx"
  ON "credential_vaults"("owner_user_id");

DO $$ BEGIN
  ALTER TABLE "credential_vaults" ADD CONSTRAINT "credential_vaults_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credential_vaults" ADD CONSTRAINT "credential_vaults_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "credential_entries" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "username" TEXT,
    "secret_encrypted" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "entry_type" TEXT NOT NULL DEFAULT 'GENERIC',
    "equipment_id" TEXT,
    "license_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "last_revealed_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credential_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "credential_entries_vault_id_is_active_idx"
  ON "credential_entries"("vault_id", "is_active");
CREATE INDEX IF NOT EXISTS "credential_entries_equipment_id_idx"
  ON "credential_entries"("equipment_id");
CREATE INDEX IF NOT EXISTS "credential_entries_license_id_idx"
  ON "credential_entries"("license_id");

DO $$ BEGIN
  ALTER TABLE "credential_entries" ADD CONSTRAINT "credential_entries_vault_id_fkey"
    FOREIGN KEY ("vault_id") REFERENCES "credential_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credential_entries" ADD CONSTRAINT "credential_entries_equipment_id_fkey"
    FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credential_entries" ADD CONSTRAINT "credential_entries_license_id_fkey"
    FOREIGN KEY ("license_id") REFERENCES "software_licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credential_entries" ADD CONSTRAINT "credential_entries_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credential_entries" ADD CONSTRAINT "credential_entries_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "credential_shares" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "user_id" TEXT,
    "family_id" TEXT,
    "capability" "CredentialShareCapability" NOT NULL DEFAULT 'VIEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credential_shares_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "credential_shares_entry_id_idx" ON "credential_shares"("entry_id");

DO $$ BEGIN
  ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_entry_id_fkey"
    FOREIGN KEY ("entry_id") REFERENCES "credential_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "system_modules" (
    "key", "name", "description", "icon", "isActive", "order",
    "defaultForAdmin", "defaultForTech", "defaultForClient",
    "requiresManager", "familyScoped", "createdAt", "updatedAt"
) VALUES (
    'credentials',
    'Credenciales',
    'Bóveda de credenciales por área y enlaces a equipos',
    'KeyRound',
    true,
    6,
    true,
    false,
    false,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT ("key") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "icon" = EXCLUDED."icon",
    "order" = EXCLUDED."order",
    "updatedAt" = CURRENT_TIMESTAMP;
