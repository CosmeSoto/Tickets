-- Consentimiento explícito del titular antes de activar una credencial QR.
ALTER TYPE "AccessPassStatus" ADD VALUE IF NOT EXISTS 'PENDING_PRIVACY';

ALTER TABLE "access_passes"
  ADD COLUMN "privacy_acceptance_token_hash" VARCHAR(128),
  ADD COLUMN "privacy_acceptance_expires_at" TIMESTAMP(3),
  ADD COLUMN "privacy_accepted_at" TIMESTAMP(3),
  ADD COLUMN "privacy_accepted_ip" VARCHAR(64),
  ADD COLUMN "privacy_accepted_user_agent" VARCHAR(1000),
  ADD COLUMN "privacy_acceptance_hash" VARCHAR(128);

CREATE UNIQUE INDEX "access_passes_privacy_acceptance_token_hash_key"
  ON "access_passes"("privacy_acceptance_token_hash");
CREATE INDEX "access_passes_privacy_acceptance_expires_at_idx"
  ON "access_passes"("privacy_acceptance_expires_at");
