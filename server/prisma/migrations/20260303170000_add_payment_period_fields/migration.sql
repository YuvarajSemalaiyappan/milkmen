-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "periodFromDate" DATE;
ALTER TABLE "Payment" ADD COLUMN "periodToDate" DATE;
ALTER TABLE "Payment" ADD COLUMN "periodFromShift" "Shift";
ALTER TABLE "Payment" ADD COLUMN "periodToShift" "Shift";
