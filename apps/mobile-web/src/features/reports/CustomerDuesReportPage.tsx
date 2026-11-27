import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserCircle, ChevronRight, Calendar, MessageCircle, MessageSquare, Loader2 } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Badge, Input, InlineLoader } from '@/components/ui'
import { EmptyState, RouteFilter } from '@/components/common'
import api, { reportsApi } from '@/services/api'
import { useRouteStore } from '@/store'
import { formatCurrency, formatDate, toLocalDateString } from '@/utils'
import { duesReminderText, prettyMonth } from '@/utils/duesMessage'
import { smsUrl, whatsAppUrl } from '@/utils/phone'
import type { ApiResponse } from '@/types'

// One row of GET /reports/customer-dues?from&to
interface DuesRow {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  balance: number
  period?: { liters: number; amount: number; paid: number }
}

// One row of GET /reports/customer-unpaid?month
interface UnpaidRow {
  id: string
  name: string
  phone: string | null
  isActive: boolean
  route: string | null
  dueAtMonthEnd: number
  lastPaid: string | null
  paidSince: number
  dueNow: number
}

const thisMonth = () => toLocalDateString(new Date()).slice(0, 7)
const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return { from: `${month}-01`, to: toLocalDateString(new Date(y, m, 0)) }
}

// Customer dues for a month (this month by default) and the route/area filter: each customer's
// running balance with what was delivered and received in the month. The second tab lists who
// didn't pay in the month (owed at month end, last paid, owes now). Same report as the phone app.
// WhatsApp/SMS send the dues reminder with the pending amount split by month.
export function CustomerDuesReportPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const [month, setMonth] = useState(thisMonth)
  // '<id>:whatsapp' or '<id>:sms' while that message's monthly split loads
  const [preparing, setPreparing] = useState<string | null>(null)
  const [view, setView] = useState<'dues' | 'unpaid'>('dues')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<DuesRow[]>([])
  const [unpaid, setUnpaid] = useState<{ month: string; monthEnd: string; customers: UnpaidRow[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [business, setBusiness] = useState('')

  const { from, to } = monthBounds(month)
  const monthLabel = prettyMonth(month, i18n.language)

  const loadDues = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = (await reportsApi.customerDues(from, to, selectedRouteId, selectedAreaId)) as ApiResponse<{ customers: DuesRow[] }>
      setRows(res.success && res.data ? res.data.customers : [])
    } catch (error) {
      console.error('Failed to load customer dues:', error)
    } finally {
      setIsLoading(false)
    }
  }, [from, to, selectedRouteId, selectedAreaId])

  const loadUnpaid = useCallback(async () => {
    try {
      const res = (await reportsApi.customerUnpaid(month, selectedRouteId, selectedAreaId)) as ApiResponse<{
        month: string
        monthEnd: string
        customers: UnpaidRow[]
      }>
      setUnpaid(res.success && res.data ? res.data : null)
    } catch (error) {
      console.error('Failed to load unpaid customers:', error)
    }
  }, [month, selectedRouteId, selectedAreaId])

  useEffect(() => {
    loadDues()
  }, [loadDues])

  useEffect(() => {
    if (view === 'unpaid') loadUnpaid()
  }, [view, loadUnpaid])

  // Business name for the reminder text
  useEffect(() => {
    api
      .get<ApiResponse<{ name: string }>>('/settings/business')
      .then((res) => setBusiness((res as unknown as ApiResponse<{ name: string }>).data?.name ?? ''))
      .catch(() => {})
  }, [])

  const matches = useCallback(
    (name: string) => !search.trim() || name.toLowerCase().includes(search.trim().toLowerCase()),
    [search]
  )
  const shownRows = useMemo(() => rows.filter((r) => matches(r.name)), [rows, matches])
  const shownUnpaid = useMemo(() => (unpaid?.customers ?? []).filter((r) => matches(r.name)), [unpaid, matches])

  const totalLiters = rows.reduce((s, r) => s + (r.period?.liters ?? 0), 0)
  const totalAmount = rows.reduce((s, r) => s + (r.period?.amount ?? 0), 0)
  const totalDue = rows.reduce((s, r) => s + Math.max(0, Number(r.balance)), 0)
  const unpaidTotal = (unpaid?.customers ?? []).reduce((s, r) => s + r.dueAtMonthEnd, 0)
  const recentFrom = monthBounds(shiftMonth(month, -1)).from

  // WhatsApp opens in a new tab: open it right away (browsers block pop-ups opened after a wait),
  // then point it at the message once the month split has loaded.
  const remind = async (channel: 'whatsapp' | 'sms', r: { id: string; name: string; phone?: string | null; balance: number }) => {
    if (!r.phone || preparing) return
    const tab = channel === 'whatsapp' ? window.open('', '_blank') : null
    setPreparing(`${r.id}:${channel}`)
    let text: string
    try {
      text = await duesReminderText(t, i18n.language, r, business)
    } finally {
      setPreparing(null)
    }
    if (channel === 'whatsapp') {
      const url = whatsAppUrl(r.phone, text)
      if (tab) tab.location.href = url
      else window.location.href = url
    } else {
      window.location.href = smsUrl(r.phone, text)
    }
  }

  const ReminderButtons = ({ r }: { r: { id: string; name: string; phone?: string | null; balance: number } }) =>
    r.phone && r.balance > 0 ? (
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => remind('whatsapp', r)}
          disabled={!!preparing}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 disabled:opacity-60"
        >
          {preparing === `${r.id}:whatsapp` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
          {t('reports.whatsapp')}
        </button>
        <button
          type="button"
          onClick={() => remind('sms', r)}
          disabled={!!preparing}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 disabled:opacity-60"
        >
          {preparing === `${r.id}:sms` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
          {t('reports.sms')}
        </button>
      </div>
    ) : null

  return (
    <AppShell title={t('reports.customerDues')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Month and route/area */}
        <Card>
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t('reports.month')}
          </h3>
          <Input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </Card>
        <RouteFilter />

        {/* Dues / didn't pay */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
          {(['dues', 'unpaid'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`py-2 rounded-lg text-sm font-medium ${
                view === v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              {v === 'dues' ? t('reports.duesView') : t('reports.notPaidIn', { month: monthLabel })}
            </button>
          ))}
        </div>

        <Input type="search" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />

        {view === 'dues' ? (
          <>
            {/* Summary for the month */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center p-3">
                <p className="text-xl font-bold text-primary-600">{totalLiters.toFixed(1)}L</p>
                <p className="text-xs text-gray-500">{t('reports.totalDelivered')}</p>
              </Card>
              <Card className="text-center p-3">
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
                <p className="text-xs text-gray-500">{t('reports.totalSales')}</p>
              </Card>
              <Card className="text-center p-3 bg-red-50 border-red-200">
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalDue)}</p>
                <p className="text-xs text-gray-500">{t('reports.totalDue')}</p>
              </Card>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500"><InlineLoader label={t('common.loading')} /></div>
            ) : shownRows.length === 0 ? (
              <EmptyState icon={<UserCircle className="w-16 h-16" />} title={t('reports.noData')} />
            ) : (
              <div className="space-y-3">
                {shownRows.map((r) => {
                  const balance = Number(r.balance)
                  return (
                    <Card
                      key={r.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${balance > 0 ? 'border-l-4 border-l-red-500' : ''}`}
                      onClick={() => navigate(`/customers/${r.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{r.name}</h3>
                            {balance > 0 && (
                              <Badge variant="error" size="sm">
                                {t('reports.due')}
                              </Badge>
                            )}
                          </div>
                          {r.address && <p className="text-sm text-gray-500">{r.address}</p>}
                          <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                            <div>
                              <p className="text-gray-500">{t('reports.delivered')}</p>
                              <p className="font-semibold">{(r.period?.liters ?? 0).toFixed(1)}L</p>
                            </div>
                            <div>
                              <p className="text-gray-500">{t('reports.value')}</p>
                              <p className="font-semibold">{formatCurrency(r.period?.amount ?? 0)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">{t('reports.received')}</p>
                              <p className="font-semibold text-green-600">{formatCurrency(r.period?.paid ?? 0)}</p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <ReminderButtons r={{ ...r, balance }} />
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-sm text-gray-500">{t('reports.balance')}</p>
                          <p className={`text-xl font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(balance)}
                          </p>
                          <ChevronRight className="w-5 h-5 text-gray-400 ml-auto mt-2" />
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('reports.notPaidHint', { month: monthLabel })}</p>
            {!unpaid ? (
              <div className="text-center py-8 text-gray-500"><InlineLoader label={t('common.loading')} /></div>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('reports.customersOwedOn', {
                    count: unpaid.customers.length,
                    amount: formatCurrency(unpaidTotal),
                    date: formatDate(unpaid.monthEnd)
                  })}
                </p>
                <div className="overflow-x-auto max-h-[34rem] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-gray-800 text-gray-500">
                      <tr className="text-left">
                        <th className="py-2 pr-2 text-right">#</th>
                        <th className="py-2 pr-2">{t('reports.customerCol')}</th>
                        <th className="py-2 pr-2 hidden sm:table-cell">{t('reports.routeCol')}</th>
                        <th className="py-2 pr-2 text-right">{t('reports.owedOn', { date: formatDate(unpaid.monthEnd) })}</th>
                        <th className="py-2 pr-2 text-right">{t('reports.lastPaid')}</th>
                        <th className="py-2 text-right">{t('reports.owesNow')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownUnpaid.map((r, i) => {
                        const old = !r.lastPaid || r.lastPaid < recentFrom
                        return (
                          <tr
                            key={r.id}
                            className="border-t border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                            onClick={() => navigate(`/customers/${r.id}`)}
                          >
                            <td className="py-2 pr-2 text-right text-gray-500">{i + 1}</td>
                            <td className="py-2 pr-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
                                {!r.isActive && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full border border-gray-300 text-gray-500">
                                    {t('common.inactive')}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1">
                                <ReminderButtons r={{ id: r.id, name: r.name, phone: r.phone, balance: r.dueNow }} />
                              </div>
                            </td>
                            <td className="py-2 pr-2 hidden sm:table-cell text-gray-600 dark:text-gray-300">{r.route ?? ''}</td>
                            <td className="py-2 pr-2 text-right font-semibold">{formatCurrency(r.dueAtMonthEnd)}</td>
                            <td className={`py-2 pr-2 text-right ${old ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}>
                              {r.lastPaid ? formatDate(r.lastPaid) : t('reports.never')}
                            </td>
                            <td className={`py-2 text-right font-semibold ${r.paidSince > 0 ? 'text-green-600' : ''}`}>
                              {formatCurrency(r.dueNow)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  )
}

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
