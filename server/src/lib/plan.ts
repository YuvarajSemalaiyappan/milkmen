// Subscription ("plan") rules shared by the app API, the admin API and the write guard.
//
// The stored status only changes when the admin acts (activate, extend, suspend, reactivate).
// A plan whose end date has passed is still stored as ACTIVE, so everything that shows or checks
// the status goes through effectiveStatus().

export type PlanStatus = 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'

export interface PlanLike {
  status: PlanStatus
  endDate: Date | null
}

export const EXPIRING_DAYS = 7

export function effectiveStatus(sub: PlanLike | null | undefined, now = new Date()): PlanStatus {
  if (!sub) return 'INACTIVE'
  if (sub.status === 'ACTIVE' && (!sub.endDate || sub.endDate <= now)) return 'EXPIRED'
  return sub.status
}

export function isPlanActive(sub: PlanLike | null | undefined, now = new Date()): boolean {
  return effectiveStatus(sub, now) === 'ACTIVE'
}

// Error codes sent with HTTP 402 when a business without an active plan tries to save something.
export const PLAN_ERRORS: Record<Exclude<PlanStatus, 'ACTIVE'>, { code: string; error: string }> = {
  EXPIRED: { code: 'PLAN_EXPIRED', error: 'Your plan has expired. Contact admin to renew.' },
  SUSPENDED: { code: 'PLAN_SUSPENDED', error: 'Your plan is suspended. Contact admin.' },
  INACTIVE: { code: 'PLAN_INACTIVE', error: 'Your plan is not active. Contact admin.' }
}
