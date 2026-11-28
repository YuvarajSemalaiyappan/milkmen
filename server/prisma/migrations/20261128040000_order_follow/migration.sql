-- A user can follow another user's farmer and/or customer order (both shifts): live, read-only.
-- See server/src/lib/order-follow.ts
ALTER TABLE "User" ADD COLUMN "followFarmerOrderId" TEXT;
ALTER TABLE "User" ADD COLUMN "followCustomerOrderId" TEXT;
