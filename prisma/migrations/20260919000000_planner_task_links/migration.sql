-- AlterTable
ALTER TABLE "users" ADD COLUMN     "planner_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_manage_planner" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "planner_task_links" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "planner_task_id" TEXT NOT NULL,
    "planner_plan_id" TEXT NOT NULL,
    "planner_bucket_id" TEXT,
    "etag" TEXT,
    "sync_status" TEXT NOT NULL DEFAULT 'synced',
    "sync_error" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planner_task_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planner_task_links_source_type_source_id_key" ON "planner_task_links"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "planner_task_links_planner_task_id_key" ON "planner_task_links"("planner_task_id");

-- CreateIndex
CREATE INDEX "planner_task_links_sync_status_idx" ON "planner_task_links"("sync_status");
