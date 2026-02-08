-- AlterTable
ALTER TABLE "RouteFarmer" ADD COLUMN     "areaId" TEXT;

-- CreateIndex
CREATE INDEX "RouteFarmer_areaId_idx" ON "RouteFarmer"("areaId");

-- AddForeignKey
ALTER TABLE "RouteFarmer" ADD CONSTRAINT "RouteFarmer_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
