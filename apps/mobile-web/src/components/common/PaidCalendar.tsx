import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { Card } from '@/components/ui'
import { paymentsApi } from '@/services/api'
import { toLocalDateString } from '@/utils'
import { localeOf } from '@/i18n/languages'
import type { ApiResponse, CalendarMark, PaymentCalendar } from '@/types'

const thisMonth = () => toLocalDateString(new Date()).slice(0, 7)
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// One month of a farmer's or customer's entries: a green line under paid days, red under unpaid
// days, nothing on days without milk. When the morning and evening differ, the line is split
// (left = AM, right = PM). The server decides what is paid (GET /payments/calendar), one month at a
// time. Same as the phone app's PaidCalendar. `refreshKey` (the balance) reloads it after a save.
export function PaidCalendar({ farmerId, customerId, refreshKey }: { farmerId?: string; customerId?: string; refreshKey?: unknown }) {
  const { t, i18n } = useTranslation()
  const [month, setMonth] = useState(thisMonth)
  const [result, setResult] = useState<{ key: string; data: PaymentCalendar | null; error: string | null } | null>(null)
  const key = [farmerId ?? customerId, month, String(refreshKey)].join('|')

  useEffect(() => {
    if (!farmerId && !customerId) return
    let cancelled = false
    paymentsApi
      .calendar({ farmerId, customerId, month })
      .then((res) => {
        if (!cancelled) setResult({ key, data: (res as ApiResponse<PaymentCalendar>).data ?? null, error: null })
      })
      .catch((err) => {
        if (!cancelled) setResult({ key, data: null, error: err instanceof Error ? err.message : t('common.error') })
      })
    return () => {
      cancelled = true
    }
  }, [farmerId, customerId, month, key, t])

  const loading = result?.key !== key
  const current = thisMonth()
  const lang = localeOf(i18n.language)
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const lead = new Date(y, m - 1, 1).getDay() // Sunday = 0
  const marks = new Map((result?.data?.days ?? []).map((d) => [d.date, d]))
  const today = toLocalDateString(new Date())
  // 1 Nov 2026 is a Sunday: its week gives the weekday letters in the app's language
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 1 + i).toLocaleDateString(lang, { weekday: 'narrow' }))
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const color = (mark: CalendarMark) => (mark === 'paid' ? 'bg-green-500' : 'bg-red-500')

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t('payment.paidCalendar')}</h3>
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={t('common.prev')}>
            <ChevronLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </button>
          <button type="button" onDoubleClick={() => setMonth(current)} className="font-semibold text-gray-900 dark:text-white">
            {new Date(y, m - 1, 1).toLocaleDateString(lang, { month: 'long', year: 'numeric' })}
          </button>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= current}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
            aria-label={t('common.next')}
          >
            <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-xs text-gray-500 dark:text-gray-400 mb-1">
          {weekdays.map((w, i) => <div key={i}>{w}</div>)}
        </div>
        <div className={clsx('grid grid-cols-7 gap-y-1 text-center', loading && 'opacity-50')}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const date = `${month}-${String(day).padStart(2, '0')}`
            const mark = marks.get(date)
            const am = mark?.morning ?? null
            const pm = mark?.evening ?? null
            const split = !!am && !!pm && am !== pm
            const single = am ?? pm
            const isToday = date === today
            return (
              <div key={i} className={clsx('flex flex-col items-center gap-1 py-1.5 rounded-lg border-2', isToday ? 'border-blue-500' : 'border-transparent')}>
                <span className={clsx('text-sm', date > today ? 'text-gray-400' : 'text-gray-900 dark:text-white', isToday && 'font-bold')}>{day}</span>
                {split ? (
                  <span className="flex w-3/4 h-1.5 gap-px">
                    <span className={clsx('flex-1 rounded-l-full', color(am))} />
                    <span className={clsx('flex-1 rounded-r-full', color(pm))} />
                  </span>
                ) : single ? (
                  <span className={clsx('w-3/4 h-1.5 rounded-full', color(single))} />
                ) : (
                  <span className="w-3/4 h-1.5" />
                )}
              </div>
            )
          })}
        </div>

        {loading && (
          <div className="flex justify-center mt-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        )}
        {!loading && result?.error && <p className="mt-2 text-center text-xs text-red-600">{result.error}</p>}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-4 h-1.5 rounded-full bg-green-500" />
          {t('reports.paid')}
          <span className="w-4 h-1.5 rounded-full bg-red-500 ml-3" />
          {t('reports.unpaid')}
          <span className="ml-auto">{t('shifts.am')} | {t('shifts.pm')}</span>
        </div>
      </Card>
    </div>
  )
}
