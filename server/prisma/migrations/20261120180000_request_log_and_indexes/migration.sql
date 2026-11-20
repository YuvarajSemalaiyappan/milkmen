-- Indexes for lookups that grow with years of data, and a table that records failed or slow requests.

-- Login finds a user by phone across businesses
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- Duplicate check and per-person history filter on person + date + shift
DROP INDEX IF EXISTS "Collection_farmerId_date_idx";
CREATE INDEX "Collection_farmerId_date_shift_idx" ON "Collection"("farmerId", "date", "shift");

DROP INDEX IF EXISTS "Delivery_customerId_date_idx";
CREATE INDEX "Delivery_customerId_date_shift_idx" ON "Delivery"("customerId", "date", "shift");

-- Payment history per person is always read newest first
DROP INDEX IF EXISTS "Payment_farmerId_idx";
DROP INDEX IF EXISTS "Payment_customerId_idx";
CREATE INDEX "Payment_farmerId_date_idx" ON "Payment"("farmerId", "date");
CREATE INDEX "Payment_customerId_date_idx" ON "Payment"("customerId", "date");

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "userId" TEXT,
    "businessId" TEXT,
    "error" TEXT,

    CONSTRAINT "RequestLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RequestLog_createdAt_idx" ON "RequestLog"("createdAt");
CREATE INDEX "RequestLog_businessId_createdAt_idx" ON "RequestLog"("businessId", "createdAt");
CREATE INDEX "RequestLog_status_createdAt_idx" ON "RequestLog"("status", "createdAt");
