-- Tipos de servicio de contratos: de enum fijo a catálogo editable.
-- Los valores semilla viven en prisma/seeds/contract-service-types.seed.ts

CREATE TABLE IF NOT EXISTS "contract_service_types" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_service_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_service_types_code_key" ON "contract_service_types"("code");
CREATE INDEX IF NOT EXISTS "contract_service_types_is_active_order_idx" ON "contract_service_types"("is_active", "order");

-- Conserva códigos existentes (SOCIAL_MEDIA, CONTENT, …) como texto
ALTER TABLE "contracts"
  ALTER COLUMN "service_subtype" TYPE VARCHAR(50)
  USING ("service_subtype"::text);

DROP TYPE IF EXISTS "SubscriptionServiceType";
