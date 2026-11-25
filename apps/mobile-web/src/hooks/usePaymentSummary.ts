import { useEffect, useState } from 'react'
import { paymentsApi } from '@/services/api'
import type { ApiResponse, PaymentSummary } from '@/types'

// Unpaid entries over the whole history, advance and pending for one farmer or customer,
// worked out on the server (GET /payments/summary). `key` reloads it (e.g. after an edit).
export function usePaymentSummary(person: { farmerId?: string; customerId?: string }, key?: unknown) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const { farmerId, customerId } = person

  useEffect(() => {
    if (!farmerId && !customerId) return
    let cancelled = false
    paymentsApi
      .summary(farmerId ? { farmerId } : { customerId })
      .then((res) => {
        const data = (res as ApiResponse<PaymentSummary>).data
        if (!cancelled && data) setSummary(data)
      })
      .catch((error) => console.error('Failed to load payment summary:', error))
    return () => {
      cancelled = true
    }
  }, [farmerId, customerId, key])

  return summary
}
