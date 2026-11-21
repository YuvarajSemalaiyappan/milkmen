import type { TFunction } from 'i18next'
import { reportsApi } from '@/services/api'
import { formatCurrency } from './format'
import type { ApiResponse } from '@/types'

interface CustomerPending {
  balance: number
  months: { month: string; amount: number }[]
  earlier: number
}

export const prettyMonth = (month: string, lang: string, long = false) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    month: long ? 'long' : 'short',
    year: 'numeric'
  })
}

// The dues reminder text, with what is pending split by month, most recent first (same text as the
// phone app). The server sets the balance against the latest monthly bills first, so the months add
// up to the balance. If the split can't be loaded, the plain one-line reminder is used.
export async function duesReminderText(
  t: TFunction,
  lang: string,
  r: { id: string; name: string; balance: number },
  business: string
): Promise<string> {
  try {
    const res = (await reportsApi.customerPending(r.id)) as ApiResponse<CustomerPending>
    const p = res.data
    if (!p) throw new Error('no data')
    const lines = p.months.map((m) => `${prettyMonth(m.month, lang)}: ${formatCurrency(m.amount)}`)
    if (p.earlier > 0) lines.push(`${t('reports.duesEarlier')}: ${formatCurrency(p.earlier)}`)
    if (!lines.length) throw new Error('nothing pending')
    return t('reports.duesMessageMonths', { name: r.name, business, amount: formatCurrency(p.balance), months: lines.join('\n') })
  } catch {
    return t('reports.duesMessage', { name: r.name, business, amount: formatCurrency(r.balance) })
  }
}
