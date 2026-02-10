-- Fix Customer subscription columns: rename old columns to new schema
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "subscriptionAM";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "subscriptionPM";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "subscriptionQty";
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "subscriptionQtyAM" DECIMAL(5,2);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "subscriptionQtyPM" DECIMAL(5,2);
