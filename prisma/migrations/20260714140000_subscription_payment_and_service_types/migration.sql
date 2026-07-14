-- Tipos de pago (PayPal, cripto, etc.) y subtipos de servicio (audiovisual, IA, Canvas…)

CREATE TYPE "PaymentMethodType" AS ENUM (
  'CORPORATE_CARD',
  'PAYPAL',
  'CRYPTO',
  'BANK_TRANSFER',
  'PROVIDER_INVOICE',
  'OTHER'
);

CREATE TYPE "SubscriptionServiceType" AS ENUM (
  'SOCIAL_MEDIA',
  'CONTENT',
  'AUDIOVISUAL',
  'ARTIFICIAL_INTELLIGENCE',
  'EDUCATION_LMS',
  'CLOUD_SERVICES',
  'DESIGN',
  'COMMUNICATIONS',
  'OTHER'
);

ALTER TABLE "contracts" ADD COLUMN "service_subtype" "SubscriptionServiceType";
ALTER TABLE "contracts" ADD COLUMN "payment_method_type" "PaymentMethodType" NOT NULL DEFAULT 'CORPORATE_CARD';
ALTER TABLE "contracts" ADD COLUMN "payment_account_ref" VARCHAR(300);

CREATE INDEX "contracts_payment_method_type_idx" ON "contracts"("payment_method_type");
CREATE INDEX "contracts_service_subtype_idx" ON "contracts"("service_subtype");
