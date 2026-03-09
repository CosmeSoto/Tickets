-- CreateTable
CREATE TABLE "category_analytics" (
    "id" TEXT NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "client_id" TEXT NOT NULL,
    "category_id" TEXT,
    "search_query" VARCHAR(255),
    "time_to_select" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_analytics_client_id_created_at_idx" ON "category_analytics"("client_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "category_analytics_event_type_created_at_idx" ON "category_analytics"("event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "category_analytics_category_id_created_at_idx" ON "category_analytics"("category_id", "created_at" DESC);
