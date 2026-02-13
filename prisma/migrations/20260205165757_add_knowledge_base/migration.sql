/*
  Warnings:

  - Added the required column `updatedAt` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "categoryId" TEXT NOT NULL,
    "tags" TEXT[],
    "sourceTicketId" TEXT,
    "authorId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_votes" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isHelpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_sourceTicketId_key" ON "knowledge_articles"("sourceTicketId");

-- CreateIndex
CREATE INDEX "knowledge_articles_categoryId_isPublished_idx" ON "knowledge_articles"("categoryId", "isPublished");

-- CreateIndex
CREATE INDEX "knowledge_articles_authorId_createdAt_idx" ON "knowledge_articles"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_articles_views_idx" ON "knowledge_articles"("views" DESC);

-- CreateIndex
CREATE INDEX "knowledge_articles_helpfulVotes_idx" ON "knowledge_articles"("helpfulVotes" DESC);

-- CreateIndex
CREATE INDEX "knowledge_articles_title_content_idx" ON "knowledge_articles"("title", "content");

-- CreateIndex
CREATE INDEX "article_votes_articleId_isHelpful_idx" ON "article_votes"("articleId", "isHelpful");

-- CreateIndex
CREATE UNIQUE INDEX "article_votes_articleId_userId_key" ON "article_votes"("articleId", "userId");

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_votes" ADD CONSTRAINT "article_votes_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_votes" ADD CONSTRAINT "article_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
