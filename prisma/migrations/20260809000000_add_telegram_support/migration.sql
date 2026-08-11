-- Migración: soporte Bot de Telegram (Fase 1)
-- Añade telegramChatId en users, telegramNotifications en user_settings
-- y la tabla telegram_link_tokens para el flujo de vinculación.

-- 1. Campo opcional en users para almacenar el chat_id de Telegram vinculado
ALTER TABLE "users" ADD COLUMN "telegram_chat_id" TEXT;

-- 2. Campo en user_settings para habilitar/deshabilitar alertas Telegram por usuario
ALTER TABLE "user_settings" ADD COLUMN "telegram_notifications" BOOLEAN NOT NULL DEFAULT true;

-- 3. Tabla de tokens temporales de vinculación (vida: 15 min)
CREATE TABLE "telegram_link_tokens" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at"    TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_tokens_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX "telegram_link_tokens_token_key" ON "telegram_link_tokens"("token");
CREATE INDEX "telegram_link_tokens_user_id_used_at_idx" ON "telegram_link_tokens"("user_id", "used_at");
CREATE INDEX "telegram_link_tokens_token_expires_at_idx" ON "telegram_link_tokens"("token", "expires_at");

-- FK a users con CASCADE
ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
