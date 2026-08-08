-- Extiende maestro de proveedores: crédito, plazos, banco y datos legales
ALTER TABLE "suppliers"
  ADD COLUMN IF NOT EXISTS "legal_name" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "city" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "country" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "payment_terms_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "credit_limit" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "credit_currency" VARCHAR(3) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "preferred_payment_method" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "bank_name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "bank_account_number" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "bank_account_type" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "bank_swift" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "notes" TEXT;
