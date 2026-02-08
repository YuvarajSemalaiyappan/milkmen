import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, TrendingUp, TrendingDown, IndianRupee, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button, Badge } from '@/components/ui'
import { useCollections, useDeliveries, usePayments } from '@/hooks'
import { formatCurrency, formatDate, getToday } from '@/utils'

interface DailySummary {
  date: string
  collectionLiters: number
  collectionAmount: number
  salesLiters: number
  salesAmount: number
  paidToFarmers: number
  receivedFromCustomers: number
  profit: number
}

export function DailyReportPage() {
  const { t } = useTranslation()
  const { getCollectionsByDate } = useCollections()
  const { getDeliveriesByDate } = useDeliveries()
  const { getPaymentsByDateRange } = usePayments()

  const [selectedDate, setSelectedDate] = useState(getToday())
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDailySummary()
  }, [selectedDate])

  const loadDailySummary = async () => {
    setIsLoading(true)
    try {
      const [collections, deliveries, payments] = await Promise.all([
        getCollectionsByDate(selectedDate),
        getDeliveriesByDate(selectedDate),
        getPaymentsByDateRange(selectedDate, selectedDate)
      ])

      const collectionLiters = collections.reduce((sum, c) => sum + Number(c.data.quantity), 0)
      const collectionAmount = collections.reduce((sum, c) => sum + Number(c.data.totalAmount), 0)

      const deliveredItems = deliveries.filter((d) => d.data.status === 'DELIVERED')
      const salesLiters = deliveredItems.reduce((sum, d) => sum + Number(d.data.quantity), 0)
      const salesAmount = deliveredItems.reduce((sum, d) => sum + Number(d.data.totalAmount), 0)

      const paidToFarmers = payments
        .filter((p) => p.data.type === 'PAID_TO_FARMER')
        .reduce((sum, p) => sum + Number(p.data.amount), 0)

      const receivedFromCustomers = payments
        .filter((p) => p.data.type === 'RECEIVED_FROM_CUSTOMER')
        .reduce((sum, p) => sum + Number(p.data.amount), 0)

      const profit = salesAmount - collectionAmount

      setSummary({
        date: selectedDate,
        collectionLiters,
        collectionAmount,
        salesLiters,
        salesAmount,
        paidToFarmers,
        receivedFromCustomers,
        profit
      })
    } finally {
      setIsLoading(false)
    }
  }

  const changeDate = (days: number) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    setSelectedDate(date.toISOString().split('T')[0])
  }

  const isToday = selectedDate === getToday()

  return (
    <AppShell title={t('reports.dailySummary')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Date Selector */}
        <Card>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeDate(-1)}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              {t('common.prev')}
            </Button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4 text-primary-600" />
                <span className="font-semibold">{formatDate(selectedDate)}</span>
              </div>
              {isToday && (
                <Badge variant="success" size="sm" className="mt-1">
                  {t('common.today')}
                </Badge>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeDate(1)}
              disabled={isToday}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              {t('common.next')}
            </Button>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}...
          </div>
        ) : summary ? (
          <>
            {/* Collection Summary */}
            <Card>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                {t('reports.collections')} ({t('reports.purchased')})
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t('reports.quantity')}</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {summary.collectionLiters.toFixed(1)} L
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('reports.value')}</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(summary.collectionAmount)}
                  </p>
                </div>
              </div>
            </Card>

            {/* Sales Summary */}
            <Card>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                {t('reports.sales')} ({t('reports.delivered')})
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t('reports.quantity')}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {summary.salesLiters.toFixed(1)} L
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('reports.value')}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary.salesAmount)}
                  </p>
                </div>
              </div>
            </Card>

            {/* Payments Summary */}
            <Card>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-primary-500" />
                {t('reports.payments')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t('reports.paidToFarmers')}</p>
                  <p className="text-xl font-bold text-red-600">
                    -{formatCurrency(summary.paidToFarmers)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('reports.receivedFromCustomers')}</p>
                  <p className="text-xl font-bold text-green-600">
                    +{formatCurrency(summary.receivedFromCustomers)}
                  </p>
                </div>
              </div>
            </Card>

            {/* Profit/Loss */}
            <Card className={summary.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <h3 className="font-semibold text-gray-700 mb-2">
                {t('reports.profitLoss')} ({t('reports.onPaper')})
              </h3>
              <p className={`text-3xl font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.profit >= 0 ? '+' : ''}{formatCurrency(summary.profit)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t('reports.salesMinusCollection')}
              </p>
            </Card>

            {/* Stock Summary */}
            <Card>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                {t('reports.stockSummary')}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('reports.collected')}</span>
                  <span className="font-semibold">{summary.collectionLiters.toFixed(1)} L</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('reports.sold')}</span>
                  <span className="font-semibold">-{summary.salesLiters.toFixed(1)} L</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="text-gray-700 font-medium">{t('reports.remaining')}</span>
                  <span className={`font-bold ${
                    summary.collectionLiters - summary.salesLiters >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}>
                    {(summary.collectionLiters - summary.salesLiters).toFixed(1)} L
                  </span>
                </div>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
