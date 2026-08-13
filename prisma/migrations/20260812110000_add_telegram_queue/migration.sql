-- Cola de alertas Telegram con reintentos (paralelo a email_queue).
CREATE TABLE "telegram_queue" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "chat_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'important',
    "module" TEXT,
    "link" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_queue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telegram_queue_status_scheduled_at_idx" ON "telegram_queue"("status", "scheduled_at");
CREATE INDEX "telegram_queue_chat_id_idx" ON "telegram_queue"("chat_id");
CREATE INDEX "telegram_queue_created_at_idx" ON "telegram_queue"("created_at" DESC);
