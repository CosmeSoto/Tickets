/*
  Warnings:

  - You are about to drop the column `brand` on the `equipment_models` table. All the data in the column will be lost.
  - You are about to drop the column `requires_brand` on the `equipment_types` table. All the data in the column will be lost.
  - You are about to drop the column `requires_model` on the `equipment_types` table. All the data in the column will be lost.
  - You are about to drop the column `requires_serial` on the `equipment_types` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "equipment_models_brand_model_idx";

-- DropIndex
DROP INDEX "equipment_models_brand_model_type_id_key";

-- AlterTable
ALTER TABLE "backups" ADD COLUMN     "metadata" TEXT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "family_id" TEXT;

-- AlterTable
ALTER TABLE "equipment_models" DROP COLUMN "brand";

-- AlterTable
ALTER TABLE "equipment_types" DROP COLUMN "requires_brand",
DROP COLUMN "requires_model",
DROP COLUMN "requires_serial";

-- AlterTable
ALTER TABLE "maintenance_records" ADD COLUMN     "previous_department_id" TEXT;

-- AlterTable
ALTER TABLE "news" ALTER COLUMN "content" DROP NOT NULL;

-- AlterTable
ALTER TABLE "patrol_family_config" ADD COLUMN     "strict_time_validation" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "can_manage_forms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forms_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "form_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#6B7280',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "family_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "summary" VARCHAR(500),
    "version" VARCHAR(50),
    "category_id" TEXT NOT NULL,
    "family_id" TEXT,
    "file_url" TEXT,
    "file_size" INTEGER,
    "file_type" VARCHAR(100),
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_roles" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_users" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_departments" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_families" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_downloads" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_attachments" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_categories_family_id_idx" ON "form_categories"("family_id");

-- CreateIndex
CREATE INDEX "form_categories_isActive_order_idx" ON "form_categories"("isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "forms_slug_key" ON "forms"("slug");

-- CreateIndex
CREATE INDEX "forms_category_id_idx" ON "forms"("category_id");

-- CreateIndex
CREATE INDEX "forms_family_id_idx" ON "forms"("family_id");

-- CreateIndex
CREATE INDEX "forms_is_active_created_at_idx" ON "forms"("is_active", "created_at" DESC);

-- CreateIndex
CREATE INDEX "forms_is_featured_is_active_idx" ON "forms"("is_featured", "is_active");

-- CreateIndex
CREATE INDEX "form_roles_form_id_idx" ON "form_roles"("form_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_roles_form_id_role_key" ON "form_roles"("form_id", "role");

-- CreateIndex
CREATE INDEX "form_users_form_id_idx" ON "form_users"("form_id");

-- CreateIndex
CREATE INDEX "form_users_user_id_idx" ON "form_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_users_form_id_user_id_key" ON "form_users"("form_id", "user_id");

-- CreateIndex
CREATE INDEX "form_departments_form_id_idx" ON "form_departments"("form_id");

-- CreateIndex
CREATE INDEX "form_departments_department_id_idx" ON "form_departments"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_departments_form_id_department_id_key" ON "form_departments"("form_id", "department_id");

-- CreateIndex
CREATE INDEX "form_families_form_id_idx" ON "form_families"("form_id");

-- CreateIndex
CREATE INDEX "form_families_family_id_idx" ON "form_families"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_families_form_id_family_id_key" ON "form_families"("form_id", "family_id");

-- CreateIndex
CREATE INDEX "form_downloads_form_id_created_at_idx" ON "form_downloads"("form_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "form_downloads_user_id_created_at_idx" ON "form_downloads"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "form_attachments_form_id_idx" ON "form_attachments"("form_id");

-- CreateIndex
CREATE INDEX "categories_family_id_idx" ON "categories"("family_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_categories" ADD CONSTRAINT "form_categories_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "form_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_roles" ADD CONSTRAINT "form_roles_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_users" ADD CONSTRAINT "form_users_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_users" ADD CONSTRAINT "form_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_departments" ADD CONSTRAINT "form_departments_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_departments" ADD CONSTRAINT "form_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_families" ADD CONSTRAINT "form_families_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_families" ADD CONSTRAINT "form_families_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_downloads" ADD CONSTRAINT "form_downloads_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_downloads" ADD CONSTRAINT "form_downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_attachments" ADD CONSTRAINT "form_attachments_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_attachments" ADD CONSTRAINT "form_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
