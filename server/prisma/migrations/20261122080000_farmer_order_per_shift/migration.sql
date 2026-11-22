-- Farmers get a separate sort order for morning and evening, like customers.
-- Existing rows keep shift NULL: the shared order, used for a shift until it is arranged.
ALTER TABLE "UserFarmerOrder" ADD COLUMN "shift" "Shift";

DROP INDEX IF EXISTS "UserFarmerOrder_userId_farmerId_key";
CREATE UNIQUE INDEX "UserFarmerOrder_userId_farmerId_shift_key" ON "UserFarmerOrder"("userId", "farmerId", "shift");

DROP INDEX IF EXISTS "UserFarmerOrder_userId_sortOrder_idx";
CREATE INDEX "UserFarmerOrder_userId_shift_sortOrder_idx" ON "UserFarmerOrder"("userId", "shift", "sortOrder");
