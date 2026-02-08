-- AlterEnum
ALTER TYPE "SubscriptionPlan" ADD VALUE 'FREE';

-- AlterTable
ALTER TABLE "Farmer" ADD COLUMN     "collectAM" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "collectPM" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlanPricing" (
    "id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanPricing_plan_key" ON "PlanPricing"("plan");
