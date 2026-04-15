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
import { reportsApi } from '@/services/api'
import { formatCurrency, formatDate, getToday } from '@/utils'
import type { ApiResponse } from '@/types'

interface DailyData {
  date: string
  collected: number
  delivered: number
  profit: number
}

interface ProfitLossData {
  from: string
  to: string
  collections: { count: number; liters: number; amount: number; avgRate: number }
  deliveries: { count: number; liters: number; amount: number; avgRate: number }
  payments: { paidToFarmers: number; receivedFromCustomers: number; netCashFlow: number }
  profit: { grossProfit: number; profitMargin: number; rateSpread: number }
  dailyBreakdown: DailyData[]
}

export function ProfitLossReportPage() {
  const { t } = useTranslation()

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
  const [grossProfit, setGrossProfit] = useState(0)
  const [profitMargin, setProfitMargin] = useState(0)
  const [rateSpread, setRateSpread] = useState(0)

  useEffect(() => {
    loadReport()
  }, [startDate, endDate])

  const loadReport = async () => {
    setIsLoading(true)
    try {
      const response = await reportsApi.profitLoss(startDate, endDate) as ApiResponse<ProfitLossData>
      if (response.success && response.data) {
        const data = response.data
        setCollectionStats({
          liters: data.collections.liters,
          amount: data.collections.amount,
          count: data.collections.count,
          avgRate: data.collections.avgRate
        })
        setDeliveryStats({
          liters: data.deliveries.liters,
          amount: data.deliveries.amount,
          count: data.deliveries.count,
          avgRate: data.deliveries.avgRate
        })
        setPaymentStats({
          paidToFarmers: data.payments.paidToFarmers,
          receivedFromCustomers: data.payments.receivedFromCustomers
        })
        setGrossProfit(data.profit.grossProfit)
        setProfitMargin(data.profit.profitMargin)
        setRateSpread(data.profit.rateSpread)
        setDailyData(data.dailyBreakdown.sort((a, b) => b.date.localeCompare(a.date)))
      }
    } catch (error) {
      console.error('Failed to load profit/loss report:', error)
    } finally {
      setIsLoading(false)
    }
  }

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
