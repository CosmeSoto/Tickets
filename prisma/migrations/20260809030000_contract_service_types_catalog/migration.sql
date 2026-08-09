-- Tipos de servicio de contratos: de enum fijo a catálogo editable

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

INSERT INTO "contract_service_types" ("id", "code", "name", "description", "is_active", "order", "created_at", "updated_at")
VALUES
  ('cst_social_media', 'SOCIAL_MEDIA', 'Redes sociales', NULL, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cst_content', 'CONTENT', 'Contenido / editorial', NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cst_audiovisual', 'AUDIOVISUAL', 'Servicios audiovisuales', NULL, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cst_ai', 'ARTIFICIAL_INTELLIGENCE', 'Inteligencia artificial', NULL, true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cst_education_lms', 'EDUCATION_LMS', 'Educación / LMS (Canvas, etc.)', NULL, true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cst_cloud', 'CLOUD_SERVICES', 'Servicios en la nube', NULL, true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cst_design', 'DESIGN', 'Diseño y creatividad', NULL, true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cst_comms', 'COMMUNICATIONS', 'Comunicaciones / internet', NULL, true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cst_digital_ads', 'DIGITAL_ADS', 'Publicidad digital / Ads', NULL, true, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cst_other', 'OTHER', 'Otro servicio', NULL, true, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "contracts"
  ALTER COLUMN "service_subtype" TYPE VARCHAR(50)
  USING ("service_subtype"::text);

DROP TYPE IF EXISTS "SubscriptionServiceType";
