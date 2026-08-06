-- Idempotencia del digest semanal por usuario
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "lastWeeklyDigestAt" TIMESTAMP(3);
