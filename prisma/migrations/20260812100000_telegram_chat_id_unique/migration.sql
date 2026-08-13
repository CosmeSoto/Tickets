-- Un chat de Telegram solo puede estar vinculado a un usuario activo.
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_chat_id_key" ON "users"("telegram_chat_id");
