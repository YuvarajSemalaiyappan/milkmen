-- 1. Old history: a business can say that every entry dated before a day is settled
--    ("settledBefore"). Balances are not touched; any real money difference still shows as
--    advance or pending. Set to 1 Apr 2026 for businesses that still have unpaid entries from
--    before then (left over from the time before payments had periods; owner agreed to clear them).
ALTER TABLE "Business" ADD COLUMN "settledBefore" DATE;

UPDATE "Business" b SET "settledBefore" = DATE '2026-04-01'
WHERE EXISTS (
  SELECT 1 FROM "Delivery" e
  WHERE e."businessId" = b.id AND e.status = 'DELIVERED' AND e.date < DATE '2026-04-01'
    AND NOT EXISTS (
      SELECT 1 FROM "Payment" p
      WHERE p."customerId" = e."customerId" AND p."businessId" = e."businessId"
        AND p."periodFromDate" IS NOT NULL AND e."createdAt" <= p."createdAt"
        AND (e.date, e.shift) >= (p."periodFromDate", p."periodFromShift")
        AND (e.date, e.shift) <= (p."periodToDate", p."periodToShift"))
) OR EXISTS (
  SELECT 1 FROM "Collection" e
  WHERE e."businessId" = b.id AND e.date < DATE '2026-04-01'
    AND NOT EXISTS (
      SELECT 1 FROM "Payment" p
      WHERE p."farmerId" = e."farmerId" AND p."businessId" = e."businessId"
        AND p."periodFromDate" IS NOT NULL AND e."createdAt" <= p."createdAt"
        AND (e.date, e.shift) >= (p."periodFromDate", p."periodFromShift")
        AND (e.date, e.shift) <= (p."periodToDate", p."periodToShift"))
);

-- 2. Payments made when nothing was due were saved with a period that ends before it starts
--    (e.g. 11 Mar evening -> 11 Mar morning). They cover no entries, so their money was already an
--    advance; now they are recorded as one (the payment screens and POST /payments do the same).
UPDATE "Payment"
SET type = CASE WHEN type = 'PAID_TO_FARMER' THEN 'ADVANCE_TO_FARMER'::"PaymentType" ELSE 'ADVANCE_FROM_CUSTOMER'::"PaymentType" END,
    "periodFromDate" = NULL, "periodFromShift" = NULL, "periodToDate" = NULL, "periodToShift" = NULL
WHERE type IN ('RECEIVED_FROM_CUSTOMER', 'PAID_TO_FARMER')
  AND "periodFromDate" IS NOT NULL
  AND ("periodFromDate", "periodFromShift") > ("periodToDate", "periodToShift");

-- A period never ends before it starts
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_period_order"
  CHECK ("periodFromDate" IS NULL OR ("periodFromDate", "periodFromShift") <= ("periodToDate", "periodToShift"));
