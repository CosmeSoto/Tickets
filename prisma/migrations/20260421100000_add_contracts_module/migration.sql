-- CreateEnum (safe — skip if already exists from a previous db push)
DO $$ BEGIN
  CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED', 'RENEWED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ContractCategory" AS ENUM ('EQUIPMENT_RENTAL', 'SOFTWARE_LICENSE', 'SERVICE', 'MAINTENANCE', 'SUPPORT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ContractLineType" AS ENUM ('EQUIPMENT', 'SOFTWARE', 'SERVICE', 'CONSUMABLE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'ONE_TIME');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable (safe — skip if already exists)
CREATE TABLE IF NOT EXISTS "contracts" (
    "id"                    TEXT            NOT NULL DEFAULT gen_random_uuid()::text,
    "contract_number"       VARCHAR(100),
    "name"                  VARCHAR(200)    NOT NULL,
    "description"           TEXT,
    "category"              "ContractCategory" NOT NULL DEFAULT 'SERVICE',
    "status"                "ContractStatus"   NOT NULL DEFAULT 'DRAFT',
    "supplier_id"           TEXT,
    "family_id"             TEXT,
    "start_date"            TIMESTAMP(3),
    "end_date"              TIMESTAMP(3),
    "auto_renew"            BOOLEAN         NOT NULL DEFAULT false,
    "renewal_notice_days"   INTEGER         NOT NULL DEFAULT 30,
    "billing_cycle"         "BillingCycle"  NOT NULL DEFAULT 'MONTHLY',
    "total_value"           DOUBLE PRECISION,
    "monthly_cost"          DOUBLE PRECISION,
    "currency"              VARCHAR(3)      NOT NULL DEFAULT 'USD',
    "contact_name"          VARCHAR(200),
    "contact_email"         VARCHAR(200),
    "contact_phone"         VARCHAR(50),
    "notes"                 TEXT,
    "terms_url"             VARCHAR(500),
    "expiry_alert_sent_at"  TIMESTAMP(3),
    "created_by"            TEXT            NOT NULL,
    "created_at"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "contract_lines" (
    "id"            TEXT            NOT NULL DEFAULT gen_random_uuid()::text,
    "contract_id"   TEXT            NOT NULL,
    "type"          "ContractLineType" NOT NULL DEFAULT 'SERVICE',
    "description"   VARCHAR(500)    NOT NULL,
    "quantity"      DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price"    DOUBLE PRECISION,
    "total_price"   DOUBLE PRECISION,
    "equipment_id"  TEXT,
    "license_id"    TEXT,
    "notes"         TEXT,
    "order"         INTEGER         NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "contract_attachments" (
    "id"            TEXT            NOT NULL DEFAULT gen_random_uuid()::text,
    "contract_id"   TEXT            NOT NULL,
    "filename"      VARCHAR(255)    NOT NULL,
    "original_name" VARCHAR(255)    NOT NULL,
    "mime_type"     VARCHAR(100)    NOT NULL,
    "size"          INTEGER         NOT NULL,
    "path"          VARCHAR(500)    NOT NULL,
    "uploaded_by"   TEXT            NOT NULL,
    "created_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (safe)
CREATE INDEX IF NOT EXISTS "contracts_status_end_date_idx"       ON "contracts"("status", "end_date");
CREATE INDEX IF NOT EXISTS "contracts_supplier_id_idx"            ON "contracts"("supplier_id");
CREATE INDEX IF NOT EXISTS "contracts_family_id_idx"              ON "contracts"("family_id");
CREATE INDEX IF NOT EXISTS "contracts_created_by_idx"             ON "contracts"("created_by");
CREATE INDEX IF NOT EXISTS "contracts_created_at_idx"             ON "contracts"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "contract_lines_contract_id_idx"       ON "contract_lines"("contract_id");
CREATE INDEX IF NOT EXISTS "contract_lines_equipment_id_idx"      ON "contract_lines"("equipment_id");
CREATE INDEX IF NOT EXISTS "contract_lines_license_id_idx"        ON "contract_lines"("license_id");
CREATE INDEX IF NOT EXISTS "contract_attachments_contract_id_idx" ON "contract_attachments"("contract_id");

-- AddForeignKey (safe)
DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_equipment_id_fkey"
    FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_license_id_fkey"
    FOREIGN KEY ("license_id") REFERENCES "software_licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "contract_attachments" ADD CONSTRAINT "contract_attachments_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "contract_attachments" ADD CONSTRAINT "contract_attachments_uploaded_by_fkey"
    FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
