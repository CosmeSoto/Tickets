-- AlterTable: Remove specifications column from equipment
-- Reason: Replaced by structured customValues (custom fields)
ALTER TABLE "equipment" DROP COLUMN IF EXISTS "specifications";

-- AlterTable: Remove specifications column from equipment_models
ALTER TABLE "equipment_models" DROP COLUMN IF EXISTS "specifications";
