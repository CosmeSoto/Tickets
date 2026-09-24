-- CreateTable
CREATE TABLE "help_faqs" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "media_url" TEXT,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "help_faqs_module_is_active_idx" ON "help_faqs"("module", "is_active");
