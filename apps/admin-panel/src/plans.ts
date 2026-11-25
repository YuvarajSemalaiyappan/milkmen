import type { SubscriptionPlan } from '@/types'

// Paid plans, in the order they are shown. Prices come from the server (Settings → Subscription
// Pricing); `fallback` is only used until a price has been saved there.
export const PLANS: { value: SubscriptionPlan; label: string; days: number; fallback: number }[] = [
  { value: 'MONTHLY', label: 'Monthly', days: 30, fallback: 299 },
  { value: 'QUARTERLY', label: 'Quarterly', days: 90, fallback: 799 },
  { value: 'HALF_YEARLY', label: 'Half Yearly', days: 180, fallback: 1499 },
  { value: 'ANNUAL', label: 'Annual', days: 365, fallback: 2499 }
]

export type Prices = Record<SubscriptionPlan, number>

export function pricesFrom(rows: { plan: string; amount: number }[] | undefined): Prices {
  const prices = Object.fromEntries(PLANS.map((p) => [p.value, p.fallback])) as Prices
  for (const row of rows || []) {
    if (row.plan in prices) prices[row.plan as SubscriptionPlan] = Number(row.amount)
  }
  return prices
}
