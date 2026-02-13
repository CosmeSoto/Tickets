-- CreateTable
CREATE TABLE "resolution_plans" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_tasks" INTEGER NOT NULL DEFAULT 0,
    "completed_tasks" INTEGER NOT NULL DEFAULT 0,
    "estimated_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actual_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "target_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolution_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_tasks" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "estimated_hours" DOUBLE PRECISION,
    "actual_hours" DOUBLE PRECISION,
    "assigned_to" TEXT,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolution_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_knowledge_articles" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resolution_plans_ticket_id_idx" ON "resolution_plans"("ticket_id");

-- CreateIndex
CREATE INDEX "resolution_plans_created_by_idx" ON "resolution_plans"("created_by");

-- CreateIndex
CREATE INDEX "resolution_tasks_plan_id_idx" ON "resolution_tasks"("plan_id");

-- CreateIndex
CREATE INDEX "resolution_tasks_assigned_to_idx" ON "resolution_tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "ticket_knowledge_articles_ticket_id_idx" ON "ticket_knowledge_articles"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_knowledge_articles_article_id_idx" ON "ticket_knowledge_articles"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_knowledge_articles_ticket_id_article_id_key" ON "ticket_knowledge_articles"("ticket_id", "article_id");

-- AddForeignKey
ALTER TABLE "resolution_plans" ADD CONSTRAINT "resolution_plans_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_plans" ADD CONSTRAINT "resolution_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_tasks" ADD CONSTRAINT "resolution_tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "resolution_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_tasks" ADD CONSTRAINT "resolution_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_knowledge_articles" ADD CONSTRAINT "ticket_knowledge_articles_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_knowledge_articles" ADD CONSTRAINT "ticket_knowledge_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_knowledge_articles" ADD CONSTRAINT "ticket_knowledge_articles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
