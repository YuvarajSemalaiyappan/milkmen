-- Map pins for farmers and customers (phone app): point, GPS accuracy, landmark, who/when.
ALTER TABLE "Farmer" ADD COLUMN "latitude" DECIMAL(9,6),
ADD COLUMN "longitude" DECIMAL(9,6),
ADD COLUMN "locationAccuracy" INTEGER,
ADD COLUMN "landmark" TEXT,
ADD COLUMN "locationUpdatedAt" TIMESTAMP(3),
ADD COLUMN "locationUpdatedById" TEXT;

ALTER TABLE "Customer" ADD COLUMN "latitude" DECIMAL(9,6),
ADD COLUMN "longitude" DECIMAL(9,6),
ADD COLUMN "locationAccuracy" INTEGER,
ADD COLUMN "landmark" TEXT,
ADD COLUMN "locationUpdatedAt" TIMESTAMP(3),
ADD COLUMN "locationUpdatedById" TEXT;
