-- AlterTable
ALTER TABLE "oauth_configs" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "oauth_configs" ALTER COLUMN "clientSecret" DROP NOT NULL;
ALTER TABLE "oauth_configs" ADD COLUMN "reuseAzureAdCredentials" BOOLEAN NOT NULL DEFAULT false;
