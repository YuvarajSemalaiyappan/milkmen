import type { Payment, Shift } from '@/types'

export function shiftOrd(shift: Shift): number {
  return shift === 'MORNING' ? 0 : 1
}

export function isInShiftRange(
  recordDate: string,
  recordShift: Shift,
  fromDate: string,
  fromShift: Shift,
  toDate: string,
  toShift: Shift
): boolean {
  if (recordDate > fromDate && recordDate < toDate) return true
  if (recordDate === fromDate && recordDate === toDate) {
    return shiftOrd(recordShift) >= shiftOrd(fromShift) && shiftOrd(recordShift) <= shiftOrd(toShift)
  }
  if (recordDate === fromDate) return shiftOrd(recordShift) >= shiftOrd(fromShift)
  if (recordDate === toDate) return shiftOrd(recordShift) <= shiftOrd(toShift)
  return false
}

const toDateOnly = (d: string) => d.slice(0, 10)

export type PaidPeriodPayment = Pick<
  Payment,
  'periodFromDate' | 'periodToDate' | 'periodFromShift' | 'periodToShift' | 'createdAt'
>

// An entry counts as paid only if some payment's (date+shift) range covers it
// AND the entry already existed when that payment was recorded. The createdAt
// cutoff prevents back-dated entries added after a payment from inheriting its
// "paid" status, since the Payment schema records only period bounds, not a
// link to specific entries.
export function isEntryPaid(
  entryDate: string,
  entryShift: Shift,
  entryCreatedAt: string,
  payments: PaidPeriodPayment[]
): boolean {
  const eDate = toDateOnly(entryDate)
  return payments.some((p) => {
    if (!p.periodFromDate || !p.periodToDate) return false
    const fromShift: Shift = p.periodFromShift || 'MORNING'
    const toShift: Shift = p.periodToShift || 'EVENING'
    return (
      entryCreatedAt <= p.createdAt &&
      isInShiftRange(
        eDate,
        entryShift,
        toDateOnly(p.periodFromDate),
        fromShift,
        toDateOnly(p.periodToDate),
        toShift
      )
    )
  })
}
