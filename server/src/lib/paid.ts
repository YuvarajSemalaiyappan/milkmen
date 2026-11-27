import { Prisma } from '@prisma/client'
import prisma from './prisma.js'

// The one place that decides whether a collection or delivery is paid. Both apps read the answer
// from the server (isPaid on lists, paidTill and unpaid totals from /payments/summary) instead of
// keeping their own copy of the rule.
//
// An entry is paid when a payment for the same person has a period that covers the entry's
// date and shift AND the entry already existed when that payment was recorded (an entry added
// later inside a paid period is not silently counted as paid). Regular payments always have a
// period (CHECK "Payment_period_required"); advances never cover entries.
//
// `e` must be the alias of a "Collection" or "Delivery" row.

export type EntryKind = 'collection' | 'delivery'

/** SQL condition: entry `e` is covered by one of its person's payment periods. */
export function paidSql(kind: EntryKind) {
  const person = kind === 'collection' ? Prisma.sql`p."farmerId" = e."farmerId"` : Prisma.sql`p."customerId" = e."customerId"`
  return Prisma.sql`EXISTS (
    SELECT 1 FROM "Payment" p
    WHERE ${person} AND p."businessId" = e."businessId"
      AND p."periodFromDate" IS NOT NULL
      AND e."createdAt" <= p."createdAt"
      AND (e.date, e.shift) >= (p."periodFromDate", p."periodFromShift")
      AND (e.date, e.shift) <= (p."periodToDate", p."periodToShift")
  )`
}

/** The ids, out of `ids`, of entries that are paid. One query whatever the list size. */
export async function paidIds(kind: EntryKind, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const table = kind === 'collection' ? Prisma.sql`"Collection"` : Prisma.sql`"Delivery"`
  // Only delivered milk can be paid for
  const delivered = kind === 'delivery' ? Prisma.sql`AND e.status = 'DELIVERED'` : Prisma.empty
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT e.id FROM ${table} e
    WHERE e.id = ANY(${ids}::text[]) ${delivered} AND ${paidSql(kind)}`
  return new Set(rows.map((r) => r.id))
}

/** Adds isPaid to each row, when the client asked for it (`paid=1`). */
export async function withPaid<T extends { id: string }>(kind: EntryKind, rows: T[], wanted: unknown): Promise<(T & { isPaid?: boolean })[]> {
  if (wanted !== '1' && wanted !== 'true') return rows
  const paid = await paidIds(kind, rows.map((r) => r.id))
  return rows.map((r) => ({ ...r, isPaid: paid.has(r.id) }))
}
