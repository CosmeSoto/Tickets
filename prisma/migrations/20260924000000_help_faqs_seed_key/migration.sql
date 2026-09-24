-- AlterTable
ALTER TABLE "help_faqs" ADD COLUMN "seed_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "help_faqs_seed_key_key" ON "help_faqs"("seed_key");
