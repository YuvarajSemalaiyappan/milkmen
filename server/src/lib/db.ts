import { Prisma } from '@prisma/client'

// Small helpers that keep the number of database round trips per request low and constant,
// whatever the amount of data. See the "Performance rules" section in RULES.md.

export class NotFoundError extends Error {}

// Reads one row of a business-owned table and locks it until the transaction ends, in a single
// query. Use it in edit/delete handlers so two edits of the same entry cannot both adjust a balance.
type LockableTable = 'Collection' | 'Delivery' | 'Payment'
export async function lockOwnedRow<T>(
  tx: Prisma.TransactionClient,
  table: LockableTable,
  id: string,
  businessId: string
): Promise<T> {
  const rows = await tx.$queryRaw<T[]>`
    SELECT * FROM ${Prisma.raw(`"${table}"`)} WHERE id = ${id} AND "businessId" = ${businessId} FOR UPDATE`
  if (!rows.length) throw new NotFoundError(`${table} not found`)
  return rows[0]
}

// Only count when the client asked for a page: a count over years of rows is the slowest part
// of a list request, and neither app shows it.
export function wantsTotal(page: unknown): boolean {
  return typeof page === 'string' && page.length > 0
}

// Inclusive date range from YYYY-MM-DD query values. Missing values fall back to the given defaults.
export function dayRange(from: unknown, to: unknown, defaultDays = 30) {
  const toDate = typeof to === 'string' && to ? new Date(to) : new Date()
  const fromDate =
    typeof from === 'string' && from ? new Date(from) : new Date(toDate.getTime() - defaultDays * 24 * 60 * 60 * 1000)
  fromDate.setHours(0, 0, 0, 0)
  toDate.setHours(23, 59, 59, 999)
  return { fromDate, toDate }
}

export const ymd = (d: Date) => d.toISOString().split('T')[0]
