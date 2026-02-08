-- AlterTable
ALTER TABLE "RouteCustomer" ADD COLUMN     "areaId" TEXT;

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Area_routeId_sortOrder_idx" ON "Area"("routeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Area_routeId_name_key" ON "Area"("routeId", "name");

-- CreateIndex
CREATE INDEX "RouteCustomer_areaId_idx" ON "RouteCustomer"("areaId");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteCustomer" ADD CONSTRAINT "RouteCustomer_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
