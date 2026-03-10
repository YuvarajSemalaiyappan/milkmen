-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: set updatedAt to createdAt for existing rows
UPDATE "Payment" SET "updatedAt" = "createdAt";
