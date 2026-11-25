-- The schema has PlanPricing.createdAt but the migration that created the table left it out,
-- so every Prisma query on PlanPricing failed (P2022) and admin pricing could not load or save.
ALTER TABLE "PlanPricing" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
