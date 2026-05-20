-- CreateEnum
CREATE TYPE "NewsType" AS ENUM ('NEWS', 'ANNOUNCEMENT', 'EVENT', 'BIRTHDAY', 'HOLIDAY', 'ALERT', 'INTERNAL_AD', 'RECOGNITION');

-- CreateEnum
CREATE TYPE "NewsPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "landing_page_content" ALTER COLUMN "footer_text" SET DEFAULT '© 2025 Sistema de Tickets. Todos los derechos reservados.';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "news_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "summary" VARCHAR(500),
    "image_url" TEXT,
    "type" "NewsType" NOT NULL DEFAULT 'NEWS',
    "priority" "NewsPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "NewsStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "allow_comments" BOOLEAN NOT NULL DEFAULT false,
    "allow_reactions" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_roles" (
    "id" TEXT NOT NULL,
    "news_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_users" (
    "id" TEXT NOT NULL,
    "news_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_departments" (
    "id" TEXT NOT NULL,
    "news_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_families" (
    "id" TEXT NOT NULL,
    "news_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_views" (
    "id" TEXT NOT NULL,
    "news_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_reactions" (
    "id" TEXT NOT NULL,
    "news_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reaction" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_comments" (
    "id" TEXT NOT NULL,
    "news_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_attachments" (
    "id" TEXT NOT NULL,
    "news_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_slug_key" ON "news"("slug");

-- CreateIndex
CREATE INDEX "news_type_status_idx" ON "news"("type", "status");

-- CreateIndex
CREATE INDEX "news_status_created_at_idx" ON "news"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "news_is_featured_status_idx" ON "news"("is_featured", "status");

-- CreateIndex
CREATE INDEX "news_start_date_end_date_idx" ON "news"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "news_roles_news_id_idx" ON "news_roles"("news_id");

-- CreateIndex
CREATE INDEX "news_roles_role_idx" ON "news_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "news_roles_news_id_role_key" ON "news_roles"("news_id", "role");

-- CreateIndex
CREATE INDEX "news_users_news_id_idx" ON "news_users"("news_id");

-- CreateIndex
CREATE INDEX "news_users_user_id_idx" ON "news_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_users_news_id_user_id_key" ON "news_users"("news_id", "user_id");

-- CreateIndex
CREATE INDEX "news_departments_news_id_idx" ON "news_departments"("news_id");

-- CreateIndex
CREATE INDEX "news_departments_department_id_idx" ON "news_departments"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_departments_news_id_department_id_key" ON "news_departments"("news_id", "department_id");

-- CreateIndex
CREATE INDEX "news_families_news_id_idx" ON "news_families"("news_id");

-- CreateIndex
CREATE INDEX "news_families_family_id_idx" ON "news_families"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_families_news_id_family_id_key" ON "news_families"("news_id", "family_id");

-- CreateIndex
CREATE INDEX "news_views_news_id_idx" ON "news_views"("news_id");

-- CreateIndex
CREATE INDEX "news_views_user_id_idx" ON "news_views"("user_id");

-- CreateIndex
CREATE INDEX "news_views_viewed_at_idx" ON "news_views"("viewed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "news_views_news_id_user_id_key" ON "news_views"("news_id", "user_id");

-- CreateIndex
CREATE INDEX "news_reactions_news_id_idx" ON "news_reactions"("news_id");

-- CreateIndex
CREATE INDEX "news_reactions_user_id_idx" ON "news_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_reactions_news_id_user_id_key" ON "news_reactions"("news_id", "user_id");

-- CreateIndex
CREATE INDEX "news_comments_news_id_created_at_idx" ON "news_comments"("news_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "news_comments_user_id_idx" ON "news_comments"("user_id");

-- CreateIndex
CREATE INDEX "news_attachments_news_id_idx" ON "news_attachments"("news_id");

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_roles" ADD CONSTRAINT "news_roles_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_users" ADD CONSTRAINT "news_users_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_users" ADD CONSTRAINT "news_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_departments" ADD CONSTRAINT "news_departments_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_departments" ADD CONSTRAINT "news_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_families" ADD CONSTRAINT "news_families_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_families" ADD CONSTRAINT "news_families_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_views" ADD CONSTRAINT "news_views_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_views" ADD CONSTRAINT "news_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_reactions" ADD CONSTRAINT "news_reactions_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_reactions" ADD CONSTRAINT "news_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "news_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_attachments" ADD CONSTRAINT "news_attachments_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_attachments" ADD CONSTRAINT "news_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
