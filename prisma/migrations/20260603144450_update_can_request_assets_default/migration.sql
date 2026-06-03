-- AlterTable
ALTER TABLE "users" ALTER COLUMN "can_request_assets" SET DEFAULT true;

-- Update existing users
UPDATE "users" SET "can_request_assets" = true WHERE "can_request_assets" = false;
