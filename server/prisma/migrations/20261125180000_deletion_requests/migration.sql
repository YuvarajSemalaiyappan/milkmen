-- Account deletion requests (from the apps and the public /delete-account page). See schema.prisma.

-- CreateEnum
CREATE TYPE "DeletionRequestSource" AS ENUM ('APP', 'WEB_FORM');

-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'DONE', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DeletionRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "DeletionRequestSource" NOT NULL,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "businessId" TEXT,
    "role" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessName" TEXT,
    "reason" TEXT,
    "handledAt" TIMESTAMP(3),
    "handledBy" TEXT,
    "adminNote" TEXT,

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletionRequest_status_createdAt_idx" ON "DeletionRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DeletionRequest_userId_status_idx" ON "DeletionRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "DeletionRequest_phone_status_idx" ON "DeletionRequest"("phone", "status");
