-- AlterTable
ALTER TABLE "oauth_accounts" ADD COLUMN     "scope" TEXT;

-- CreateTable
CREATE TABLE "personal_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "start_time" TEXT,
    "end_time" TEXT,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "family_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_task_ms_todo_links" (
    "id" TEXT NOT NULL,
    "personal_task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ms_task_list_id" TEXT NOT NULL,
    "ms_task_id" TEXT NOT NULL,
    "etag" TEXT,
    "sync_status" TEXT NOT NULL DEFAULT 'synced',
    "sync_error" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_task_ms_todo_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_tasks_user_id_due_date_idx" ON "personal_tasks"("user_id", "due_date");

-- CreateIndex
CREATE INDEX "personal_tasks_user_id_status_idx" ON "personal_tasks"("user_id", "status");

-- CreateIndex
CREATE INDEX "personal_tasks_family_id_idx" ON "personal_tasks"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_task_ms_todo_links_personal_task_id_key" ON "personal_task_ms_todo_links"("personal_task_id");

-- CreateIndex
CREATE INDEX "personal_task_ms_todo_links_sync_status_idx" ON "personal_task_ms_todo_links"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "personal_task_ms_todo_links_user_id_ms_task_id_key" ON "personal_task_ms_todo_links"("user_id", "ms_task_id");

-- AddForeignKey
ALTER TABLE "personal_tasks" ADD CONSTRAINT "personal_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_tasks" ADD CONSTRAINT "personal_tasks_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_task_ms_todo_links" ADD CONSTRAINT "personal_task_ms_todo_links_personal_task_id_fkey" FOREIGN KEY ("personal_task_id") REFERENCES "personal_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

