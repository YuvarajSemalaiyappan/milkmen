-- Every regular payment (RECEIVED_FROM_CUSTOMER, PAID_TO_FARMER) must say which days it pays for.
--
-- Payments recorded in Feb-Mar 2026, before payments had a period, have none. Their money counts in
-- the balance, but no entry counts as paid by them, so those entries showed as unpaid forever and
-- the same money showed as an "advance" on the farmer/customer page.
--
-- Fix, per person, without changing any amount (balances stay exactly the same):
--   1. Old payments, oldest first, get a period covering the entries that existed when each was
--      recorded, starting where the previous one ended (like the apps' default period).
--      An old payment recorded when nothing new was due gets the previous payment's period
--      (or the next one's, if it came first); with no entries at all, its own day.
--   2. "Legacy" entries are those dated before the person's first payment that has a period.
--      Legacy entries entered after the last old payment are covered by moving the start of that
--      first period payment back to where the old payments ended.
-- An entry is still paid only if a period covers it AND it existed when that payment was recorded.
--
-- Then a CHECK makes a period required for regular payments (advances may have none) and stops
-- half-filled periods.

DO $$
DECLARE
  per RECORD;
  pay RECORD;
  first_id text;
  first_d date;
  first_s "Shift";
  cur_d date;        -- end of the last period given out (NULL = none yet)
  cur_s "Shift";
  from_d date;
  from_s "Shift";
  to_d date;
  to_s "Shift";
  prev_from_d date;
  prev_from_s "Shift";
  prev_to_d date;
  prev_to_s "Shift";
  waiting text[];    -- old payments with nothing new to cover, before the first one that has
BEGIN
  CREATE TEMP TABLE "_legacy" (d date, s "Shift", c timestamp(3));

  FOR per IN
    SELECT DISTINCT "businessId", "farmerId", "customerId"
    FROM "Payment"
    WHERE type IN ('RECEIVED_FROM_CUSTOMER', 'PAID_TO_FARMER')
      AND "periodFromDate" IS NULL
  LOOP
    -- The person's first payment that has a period (by period start)
    first_id := NULL;
    SELECT id, "periodFromDate", "periodFromShift" INTO first_id, first_d, first_s
    FROM "Payment"
    WHERE "businessId" = per."businessId"
      AND "farmerId" IS NOT DISTINCT FROM per."farmerId"
      AND "customerId" IS NOT DISTINCT FROM per."customerId"
      AND "periodFromDate" IS NOT NULL AND "periodToDate" IS NOT NULL
      AND "periodFromShift" IS NOT NULL AND "periodToShift" IS NOT NULL
    ORDER BY "periodFromDate", "periodFromShift"
    LIMIT 1;

    -- Legacy entries: collections for a farmer, delivered deliveries for a customer
    TRUNCATE "_legacy";
    IF per."farmerId" IS NOT NULL THEN
      INSERT INTO "_legacy"
      SELECT e.date, e.shift, e."createdAt" FROM "Collection" e
      WHERE e."businessId" = per."businessId" AND e."farmerId" = per."farmerId"
        AND (first_id IS NULL OR (e.date, e.shift) < (first_d, first_s));
    ELSE
      INSERT INTO "_legacy"
      SELECT e.date, e.shift, e."createdAt" FROM "Delivery" e
      WHERE e."businessId" = per."businessId" AND e."customerId" = per."customerId"
        AND e.status = 'DELIVERED'
        AND (first_id IS NULL OR (e.date, e.shift) < (first_d, first_s));
    END IF;

    cur_d := NULL;
    cur_s := NULL;
    prev_from_d := NULL;
    waiting := '{}';

    FOR pay IN
      SELECT id, date, "createdAt"
      FROM "Payment"
      WHERE "businessId" = per."businessId"
        AND "farmerId" IS NOT DISTINCT FROM per."farmerId"
        AND "customerId" IS NOT DISTINCT FROM per."customerId"
        AND type IN ('RECEIVED_FROM_CUSTOMER', 'PAID_TO_FARMER')
        AND "periodFromDate" IS NULL
      ORDER BY "createdAt", id
    LOOP
      -- The latest legacy entry that existed when this payment was recorded, after the last period
      to_d := NULL;
      SELECT l.d, l.s INTO to_d, to_s
      FROM "_legacy" l
      WHERE l.c <= pay."createdAt"
        AND (cur_d IS NULL OR (l.d, l.s) > (cur_d, cur_s))
      ORDER BY l.d DESC, l.s DESC
      LIMIT 1;

      IF to_d IS NOT NULL THEN
        IF cur_d IS NULL THEN
          SELECT l.d, l.s INTO from_d, from_s FROM "_legacy" l ORDER BY l.d, l.s LIMIT 1;
        ELSIF cur_s = 'MORNING' THEN
          from_d := cur_d;
          from_s := 'EVENING';
        ELSE
          from_d := cur_d + 1;
          from_s := 'MORNING';
        END IF;

        UPDATE "Payment"
        SET "periodFromDate" = from_d, "periodFromShift" = from_s,
            "periodToDate" = to_d, "periodToShift" = to_s
        WHERE id = pay.id OR id = ANY (waiting);

        waiting := '{}';
        cur_d := to_d;
        cur_s := to_s;
        prev_from_d := from_d;
        prev_from_s := from_s;
        prev_to_d := to_d;
        prev_to_s := to_s;
      ELSIF prev_from_d IS NOT NULL THEN
        -- Nothing new was due: paid together with the previous payment's days
        UPDATE "Payment"
        SET "periodFromDate" = prev_from_d, "periodFromShift" = prev_from_s,
            "periodToDate" = prev_to_d, "periodToShift" = prev_to_s
        WHERE id = pay.id;
      ELSE
        waiting := waiting || pay.id;
      END IF;
    END LOOP;

    -- Old payments that never had anything to cover: their own day (they stay as advance money)
    IF array_length(waiting, 1) IS NOT NULL THEN
      UPDATE "Payment"
      SET "periodFromDate" = date, "periodFromShift" = 'MORNING',
          "periodToDate" = date, "periodToShift" = 'MORNING'
      WHERE id = ANY (waiting);
    END IF;

    -- Legacy entries entered after the last old payment: start the first period payment earlier
    IF first_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM "_legacy" l WHERE cur_d IS NULL OR (l.d, l.s) > (cur_d, cur_s)
    ) THEN
      IF cur_d IS NULL THEN
        SELECT l.d, l.s INTO from_d, from_s FROM "_legacy" l ORDER BY l.d, l.s LIMIT 1;
      ELSIF cur_s = 'MORNING' THEN
        from_d := cur_d;
        from_s := 'EVENING';
      ELSE
        from_d := cur_d + 1;
        from_s := 'MORNING';
      END IF;
      UPDATE "Payment"
      SET "periodFromDate" = from_d, "periodFromShift" = from_s
      WHERE id = first_id AND (from_d, from_s) < ("periodFromDate", "periodFromShift");
    END IF;
  END LOOP;

  DROP TABLE "_legacy";
END $$;

-- A period is all four fields or none
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_period_complete"
  CHECK (num_nonnulls("periodFromDate", "periodToDate", "periodFromShift", "periodToShift") IN (0, 4));

-- Regular payments need a period; advances may have none
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_period_required"
  CHECK (type NOT IN ('RECEIVED_FROM_CUSTOMER', 'PAID_TO_FARMER') OR "periodFromDate" IS NOT NULL);
