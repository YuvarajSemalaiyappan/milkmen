import { Prisma } from '@prisma/client'

// Thrown inside a create transaction when the farmer or customer already has an entry
// for the same date and shift, and the client did not confirm a second one.
export class DuplicateEntryError extends Error {
  constructor(public existing: { id: string; quantity: unknown }[]) {
    super('DUPLICATE_ENTRY')
  }
}

// Serialises creates for one farmer/customer + date + shift, so two taps or two phones
// saving at the same moment cannot both pass the duplicate check. The lock is released
// when the transaction ends.
export async function lockEntrySlot(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${key}))`
}

export function duplicateResponse(kind: 'collection' | 'delivery', existing: { id: string; quantity: unknown }[]) {
  return {
    success: false,
    code: 'DUPLICATE_ENTRY',
    error:
      kind === 'collection'
        ? 'Milk is already entered for this farmer in this shift'
        : 'A delivery is already entered for this customer in this shift',
    existing: existing.map((e) => ({ id: e.id, quantity: Number(e.quantity) }))
  }
}

// Thrown when an entry can't be moved to another date/shift because of a payment period
export class PaidPeriodError extends Error {
  code = 'PAID_PERIOD'
}

// Checks run inside the edit transaction before an entry moves to another date or shift:
// 1. The entry already counts as paid (a payment period covers it and it existed when that payment
//    was recorded): moving it would take it out of what was paid. Blocked.
// 2. The new date/shift is inside a paid period: the entry would look paid without being paid. Blocked.
// 3. The new slot already has an entry for this person: DuplicateEntryError unless allowDuplicate.
// The new slot is locked like a create, so a move and a new entry can't both pass the duplicate check.
export async function checkEntryMove(
  tx: Prisma.TransactionClient,
  opts: {
    kind: 'collection' | 'delivery'
    businessId: string
    personId: string
    entryId: string
    entryCreatedAt: Date
    fromDate: string
    fromShift: string
    toDate: string
    toShift: string
    allowDuplicate?: boolean
  }
) {
  const personCol = Prisma.raw(opts.kind === 'collection' ? '"farmerId"' : '"customerId"')
  const periods = Prisma.sql`"Payment" p WHERE p."businessId" = ${opts.businessId} AND p.${personCol} = ${opts.personId}
    AND p."periodFromDate" IS NOT NULL AND p."periodToDate" IS NOT NULL
    AND p."periodFromShift" IS NOT NULL AND p."periodToShift" IS NOT NULL`
  const covers = (date: string, shift: string) => Prisma.sql`
    (${date}::date, ${shift}::"Shift") >= (p."periodFromDate", p."periodFromShift")
    AND (${date}::date, ${shift}::"Shift") <= (p."periodToDate", p."periodToShift")`

  // Days before the business's settledBefore count as paid too (see lib/paid.ts)
  const settled = (date: string) => Prisma.sql`
    EXISTS (SELECT 1 FROM "Business" b WHERE b.id = ${opts.businessId} AND ${date}::date < b."settledBefore")`
  const [state] = await tx.$queryRaw<{ isPaid: boolean; targetPaid: boolean }[]>`
    SELECT
      (${settled(opts.fromDate)} OR EXISTS (SELECT 1 FROM ${periods} AND ${opts.entryCreatedAt.toISOString()}::timestamp <= p."createdAt" AND ${covers(opts.fromDate, opts.fromShift)})) AS "isPaid",
      (${settled(opts.toDate)} OR EXISTS (SELECT 1 FROM ${periods} AND ${covers(opts.toDate, opts.toShift)})) AS "targetPaid"`
  if (state.isPaid) throw new PaidPeriodError('This entry is already paid, so its date or shift cannot be changed')
  if (state.targetPaid) throw new PaidPeriodError('That date and shift are inside a paid period')

  await lockEntrySlot(tx, `${opts.kind}:${opts.personId}:${opts.toDate}:${opts.toShift}`)
  if (opts.allowDuplicate) return
  const existing =
    opts.kind === 'collection'
      ? await tx.collection.findMany({
          where: { businessId: opts.businessId, farmerId: opts.personId, date: new Date(opts.toDate), shift: opts.toShift as 'MORNING' | 'EVENING', id: { not: opts.entryId } },
          select: { id: true, quantity: true }
        })
      : await tx.delivery.findMany({
          where: {
            businessId: opts.businessId,
            customerId: opts.personId,
            date: new Date(opts.toDate),
            shift: opts.toShift as 'MORNING' | 'EVENING',
            status: { not: 'CANCELLED' },
            id: { not: opts.entryId }
          },
          select: { id: true, quantity: true }
        })
  if (existing.length) throw new DuplicateEntryError(existing)
}
