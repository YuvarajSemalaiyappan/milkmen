-- Remove offline sync fields from Collection, Delivery, and Payment tables

-- Drop unique indexes on localId
DROP INDEX IF EXISTS "Collection_localId_key";
DROP INDEX IF EXISTS "Delivery_localId_key";
DROP INDEX IF EXISTS "Payment_localId_key";

-- Drop localId and syncStatus columns
ALTER TABLE "Collection" DROP COLUMN IF EXISTS "localId";
ALTER TABLE "Collection" DROP COLUMN IF EXISTS "syncStatus";

ALTER TABLE "Delivery" DROP COLUMN IF EXISTS "localId";
ALTER TABLE "Delivery" DROP COLUMN IF EXISTS "syncStatus";

ALTER TABLE "Payment" DROP COLUMN IF EXISTS "localId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "syncStatus";

-- Drop the SyncStatus enum
DROP TYPE IF EXISTS "SyncStatus";
