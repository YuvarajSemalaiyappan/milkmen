import type { Prisma } from '@prisma/client'

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
