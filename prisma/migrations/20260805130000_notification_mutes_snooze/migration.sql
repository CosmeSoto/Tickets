-- Snooze individual en notificaciones
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3);

-- Índice para filtrar snoozed en listados
CREATE INDEX IF NOT EXISTS "notifications_userId_snoozedUntil_idx"
  ON "notifications"("userId", "snoozedUntil");

-- Silenciar / snooze por entidad (hilo)
CREATE TABLE IF NOT EXISTS "notification_mutes" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "entityKey"  TEXT NOT NULL,
  "mutedUntil" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_mutes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_mutes_userId_entityKey_key"
  ON "notification_mutes"("userId", "entityKey");

CREATE INDEX IF NOT EXISTS "notification_mutes_userId_mutedUntil_idx"
  ON "notification_mutes"("userId", "mutedUntil");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_mutes_userId_fkey'
  ) THEN
    ALTER TABLE "notification_mutes"
      ADD CONSTRAINT "notification_mutes_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
