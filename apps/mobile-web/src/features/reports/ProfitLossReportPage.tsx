import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  IndianRupee,
  ArrowDownLeft,
  ArrowUpRight,
  Percent
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Input, Badge } from '@/components/ui'
import { useCollections, useDeliveries, usePayments } from '@/hooks'
import { formatCurrency, formatDate, getToday } from '@/utils'

interface DailyData {
  date: string
  collected: number
  delivered: number
  profit: number
}

export function ProfitLossReportPage() {
  const { t } = useTranslation()
  const { getCollectionsByDateRange } = useCollections()
  const { getDeliveriesByDateRange } = useDeliveries()
  const { getPaymentsByDateRange } = usePayments()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(getToday())
  const [isLoading, setIsLoading] = useState(true)

  const [collectionStats, setCollectionStats] = useState({ liters: 0, amount: 0, count: 0, avgRate: 0 })
  const [deliveryStats, setDeliveryStats] = useState({ liters: 0, amount: 0, count: 0, avgRate: 0 })
  const [paymentStats, setPaymentStats] = useState({ paidToFarmers: 0, receivedFromCustomers: 0 })
  const [dailyData, setDailyData] = useState<DailyData[]>([])

  useEffect(() => {
    loadReport()
  }, [startDate, endDate])

  const loadReport = async () => {
    setIsLoading(true)
    try {
      const [collections, deliveries, payments] = await Promise.all([
        getCollectionsByDateRange(startDate, endDate),
        getDeliveriesByDateRange(startDate, endDate),
        getPaymentsByDateRange(startDate, endDate)
      ])

      // Filter deliveries to only delivered status
      const deliveredItems = deliveries.filter(d => d.data.status === 'DELIVERED')

      // Collection stats
      const collectionLiters = collections.reduce((sum, c) => sum + Number(c.data.quantity), 0)
      const collectionAmount = collections.reduce((sum, c) => sum + Number(c.data.totalAmount), 0)
      setCollectionStats({
        liters: collectionLiters,
        amount: collectionAmount,
        count: collections.length,
        avgRate: collectionLiters > 0 ? collectionAmount / collectionLiters : 0
      })

      // Delivery stats
      const deliveryLiters = deliveredItems.reduce((sum, d) => sum + Number(d.data.quantity), 0)
      const deliveryAmount = deliveredItems.reduce((sum, d) => sum + Number(d.data.totalAmount), 0)
      setDeliveryStats({
        liters: deliveryLiters,
        amount: deliveryAmount,
        count: deliveredItems.length,
        avgRate: deliveryLiters > 0 ? deliveryAmount / deliveryLiters : 0
      })

      // Payment stats
      const paidToFarmers = payments
        .filter(p => p.data.type === 'PAID_TO_FARMER')
        .reduce((sum, p) => sum + p.data.amount, 0)
      const receivedFromCustomers = payments
        .filter(p => p.data.type === 'RECEIVED_FROM_CUSTOMER')
        .reduce((sum, p) => sum + p.data.amount, 0)
      setPaymentStats({ paidToFarmers, receivedFromCustomers })

      // Daily breakdown
      const dailyMap = new Map<string, DailyData>()

      collections.forEach(c => {
        const date = c.data.date
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { date, collected: 0, delivered: 0, profit: 0 })
        }
        dailyMap.get(date)!.collected += c.data.totalAmount
      })

      deliveredItems.forEach(d => {
        const date = d.data.date
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { date, collected: 0, delivered: 0, profit: 0 })
        }
        dailyMap.get(date)!.delivered += d.data.totalAmount
      })

      // Calculate profit for each day
      dailyMap.forEach(day => {
        day.profit = day.delivered - day.collected
      })

      const sortedDaily = Array.from(dailyMap.values())
        .sort((a, b) => b.date.localeCompare(a.date))

      setDailyData(sortedDaily)
    } finally {
      setIsLoading(false)
    }
  }

  const grossProfit = deliveryStats.amount - collectionStats.amount
  const profitMargin = deliveryStats.amount > 0 ? (grossProfit / deliveryStats.amount) * 100 : 0
  const rateSpread = deliveryStats.avgRate - collectionStats.avgRate
  const netCashFlow = paymentStats.receivedFromCustomers - paymentStats.paidToFarmers

  return (
    <AppShell title={t('reports.profitLoss')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Date Range */}
        <Card>
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t('reports.dateRange')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label={t('reports.from')}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              label={t('reports.to')}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </Card>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}...
          </div>
        ) : (
          <>
            {/* Main Profit/Loss Card */}
            <Card className={grossProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">{t('reports.grossProfit')}</p>
                <p className={`text-4xl font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {grossProfit >= 0 ? '+' : ''}{formatCurrency(grossProfit)}
                </p>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1">
                    <Percent className="w-4 h-4 text-gray-500" />
                    <span className={`font-semibold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profitMargin.toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-500">{t('reports.margin')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IndianRupee className="w-4 h-4 text-gray-500" />
                    <span className={`font-semibold ${rateSpread >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {rateSpread >= 0 ? '+' : ''}{formatCurrency(rateSpread)}
                    </span>
                    <span className="text-sm text-gray-500">{t('reports.spread')}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Collections (Expenses) */}
            <Card>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-orange-500" />
                {t('reports.collections')} ({t('reports.expense')})
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t('reports.quantity')}</p>
                  <p className="text-xl font-bold text-orange-600">{collectionStats.liters.toFixed(1)} L</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('reports.amount')}</p>
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(collectionStats.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('reports.entries')}</p>
                  <p className="text-lg font-semibold text-gray-700">{collectionStats.count}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('reports.avgRate')}</p>
                  <p className="text-lg font-semibold text-gray-700">{formatCurrency(collectionStats.avgRate)}/L</p>
                </div>
              </div>
            </Card>

            {/* Deliveries (Revenue) */}
            <Card>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-green-500" />
                {t('reports.deliveries')} ({t('reports.revenue')})
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t('reports.quantity')}</p>
                  <p className="text-xl font-bold text-green-600">{deliveryStats.liters.toFixed(1)} L</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('reports.amount')}</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(deliveryStats.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('reports.entries')}</p>
                  <p className="text-lg font-semibold text-gray-700">{deliveryStats.count}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('reports.avgRate')}</p>
                  <p className="text-lg font-semibold text-gray-700">{formatCurrency(deliveryStats.avgRate)}/L</p>
                </div>
              </div>
            </Card>

            {/* Cash Flow */}
            <Card>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-blue-500" />
                {t('reports.cashFlow')}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('reports.paidToFarmers')}</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(paymentStats.paidToFarmers)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('reports.receivedFromCustomers')}</span>
                  <span className="font-semibold text-green-600">+{formatCurrency(paymentStats.receivedFromCustomers)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-medium text-gray-700">{t('reports.netCashFlow')}</span>
                  <span className={`font-bold text-lg ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Daily Breakdown */}
            {dailyData.length > 0 && (
              <Card>
                <h3 className="font-semibold text-gray-700 mb-3">{t('reports.dailyBreakdown')}</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {dailyData.map(day => (
                    <div
                      key={day.date}
                      className={`p-3 rounded-lg ${
                        day.profit >= 0 ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">{formatDate(day.date)}</span>
                        <span className={`font-bold ${day.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {day.profit >= 0 ? '+' : ''}{formatCurrency(day.profit)}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500 mt-1">
                        <span>{t('reports.bought')}: {formatCurrency(day.collected)}</span>
                        <span>{t('reports.sold')}: {formatCurrency(day.delivered)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
