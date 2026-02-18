-- AlterTable
ALTER TABLE "user_preferences" ALTER COLUMN "timezone" SET DEFAULT 'America/Guayaquil';

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "ticketUpdates" BOOLEAN NOT NULL DEFAULT true,
    "systemAlerts" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReport" BOOLEAN NOT NULL DEFAULT false,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketCreated" BOOLEAN NOT NULL DEFAULT true,
    "ticketAssigned" BOOLEAN NOT NULL DEFAULT true,
    "statusChanged" BOOLEAN NOT NULL DEFAULT true,
    "newComments" BOOLEAN NOT NULL DEFAULT true,
    "ticketUpdated" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT NOT NULL DEFAULT '22:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '08:00',
    "autoAssignEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrentTickets" INTEGER NOT NULL DEFAULT 10,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "language" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'America/Guayaquil',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateName" TEXT,
    "templateData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "events" TEXT[],
    "secret" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "headers" JSONB,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "retry_count" INTEGER NOT NULL DEFAULT 3,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_triggered_at" TIMESTAMP(3),

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category_id" TEXT,
    "priority" VARCHAR(20) NOT NULL,
    "response_time_hours" INTEGER NOT NULL,
    "resolution_time_hours" INTEGER NOT NULL,
    "business_hours_only" BOOLEAN NOT NULL DEFAULT false,
    "business_hours_start" VARCHAR(8) NOT NULL DEFAULT '09:00:00',
    "business_hours_end" VARCHAR(8) NOT NULL DEFAULT '18:00:00',
    "business_days" VARCHAR(50) NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_violations" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sla_policy_id" TEXT NOT NULL,
    "violation_type" VARCHAR(50) NOT NULL,
    "expected_at" TIMESTAMP(3) NOT NULL,
    "actual_at" TIMESTAMP(3),
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sla_metrics" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sla_policy_id" TEXT NOT NULL,
    "response_deadline" TIMESTAMP(3),
    "resolution_deadline" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "response_sla_met" BOOLEAN,
    "resolution_sla_met" BOOLEAN,
    "response_time_minutes" INTEGER,
    "resolution_time_minutes" INTEGER,
    "business_hours_elapsed" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_sla_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "user_settings_userId_idx" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "email_queue_status_scheduledAt_idx" ON "email_queue"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "email_queue_createdAt_idx" ON "email_queue"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "email_queue_toEmail_idx" ON "email_queue"("toEmail");

-- CreateIndex
CREATE INDEX "webhooks_is_active_idx" ON "webhooks"("is_active");

-- CreateIndex
CREATE INDEX "webhook_logs_webhook_id_created_at_idx" ON "webhook_logs"("webhook_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_logs_event_created_at_idx" ON "webhook_logs"("event", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sla_policies_is_active_category_id_priority_idx" ON "sla_policies"("is_active", "category_id", "priority");

-- CreateIndex
CREATE INDEX "sla_violations_ticket_id_is_resolved_idx" ON "sla_violations"("ticket_id", "is_resolved");

-- CreateIndex
CREATE INDEX "sla_violations_sla_policy_id_created_at_idx" ON "sla_violations"("sla_policy_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_sla_metrics_ticket_id_key" ON "ticket_sla_metrics"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_sla_metrics_ticket_id_idx" ON "ticket_sla_metrics"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_sla_metrics_response_deadline_resolution_deadline_idx" ON "ticket_sla_metrics"("response_deadline", "resolution_deadline");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_violations" ADD CONSTRAINT "sla_violations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_violations" ADD CONSTRAINT "sla_violations_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_metrics" ADD CONSTRAINT "ticket_sla_metrics_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_metrics" ADD CONSTRAINT "ticket_sla_metrics_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
