/*
  Warnings:

  - You are about to drop the column `accent_color` on the `landing_page_content` table. All the data in the column will be lost.
  - You are about to drop the column `accent_color_dark` on the `landing_page_content` table. All the data in the column will be lost.
  - You are about to drop the column `auto_theme` on the `landing_page_content` table. All the data in the column will be lost.
  - You are about to drop the column `primary_color` on the `landing_page_content` table. All the data in the column will be lost.
  - You are about to drop the column `primary_color_dark` on the `landing_page_content` table. All the data in the column will be lost.
  - You are about to drop the column `secondary_color` on the `landing_page_content` table. All the data in the column will be lost.
  - You are about to drop the column `secondary_color_dark` on the `landing_page_content` table. All the data in the column will be lost.
  - You are about to drop the column `support_dark_mode` on the `landing_page_content` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "landing_page_content" DROP COLUMN "accent_color",
DROP COLUMN "accent_color_dark",
DROP COLUMN "auto_theme",
DROP COLUMN "primary_color",
DROP COLUMN "primary_color_dark",
DROP COLUMN "secondary_color",
DROP COLUMN "secondary_color_dark",
DROP COLUMN "support_dark_mode",
ADD COLUMN     "hero_cta_primary_url" TEXT NOT NULL DEFAULT '/login',
ADD COLUMN     "hero_cta_secondary_url" TEXT NOT NULL DEFAULT '#servicios';
