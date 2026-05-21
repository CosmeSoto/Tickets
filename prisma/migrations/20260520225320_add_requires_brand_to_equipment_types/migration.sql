-- AlterTable
ALTER TABLE "equipment_types" ADD COLUMN     "requires_brand" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_model" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_serial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "track_maintenance" BOOLEAN NOT NULL DEFAULT false;
