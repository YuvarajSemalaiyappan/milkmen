import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, IndianRupee, ChevronRight, Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button, Badge, Input } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useFarmers, useCollections, usePayments } from '@/hooks'
import { formatCurrency, formatDate, getToday } from '@/utils'
import type { LocalFarmer } from '@/types'

interface FarmerDue {
  farmer: LocalFarmer
  totalLiters: number
  totalAmount: number
  totalPaid: number
  balance: number
}

export function FarmerDuesReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeFarmers } = useFarmers()
  const { getCollectionsByFarmer } = useCollections()
  const { getFarmerPaymentsSummary } = usePayments()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30) // Last 30 days
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(getToday())
  const [farmerDues, setFarmerDues] = useState<FarmerDue[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadFarmerDues()
  }, [activeFarmers, startDate, endDate])

  const loadFarmerDues = async () => {
    setIsLoading(true)
    try {
      const dues: FarmerDue[] = await Promise.all(
        activeFarmers.map(async (farmer) => {
          const collections = await getCollectionsByFarmer(farmer.id, startDate, endDate)
          const paymentsSummary = await getFarmerPaymentsSummary(farmer.id, startDate, endDate)

          const totalLiters = collections.reduce((sum, c) => sum + c.data.quantity, 0)
          const totalAmount = collections.reduce((sum, c) => sum + c.data.totalAmount, 0)
          const totalPaid = paymentsSummary.totalPayments

          return {
            farmer,
            totalLiters,
            totalAmount,
            totalPaid,
            balance: totalAmount - totalPaid
          }
        })
      )

      // Sort by balance (highest first)
      dues.sort((a, b) => b.balance - a.balance)
      setFarmerDues(dues)
    } finally {
      setIsLoading(false)
    }
  }

  const totalDue = farmerDues.reduce((sum, f) => sum + Math.max(0, f.balance), 0)
  const totalLiters = farmerDues.reduce((sum, f) => sum + f.totalLiters, 0)
  const totalAmount = farmerDues.reduce((sum, f) => sum + f.totalAmount, 0)

  return (
    <AppShell title={t('reports.farmerDues')} showBack>
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

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-primary-600">{totalLiters.toFixed(1)}L</p>
            <p className="text-xs text-gray-500">{t('reports.totalCollected')}</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-gray-500">{t('reports.totalValue')}</p>
          </Card>
          <Card className="text-center p-3 bg-orange-50 border-orange-200">
            <p className="text-xl font-bold text-orange-600">{formatCurrency(totalDue)}</p>
            <p className="text-xs text-gray-500">{t('reports.totalDue')}</p>
          </Card>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}...
          </div>
        )}

        {/* Farmer List */}
        {!isLoading && farmerDues.length === 0 ? (
          <EmptyState
            icon={<Users className="w-16 h-16" />}
            title={t('reports.noData')}
            description={t('reports.noCollectionsInPeriod')}
          />
        ) : (
          <div className="space-y-3">
            {farmerDues.map((item) => (
              <Card
                key={item.farmer.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  item.balance > 0 ? 'border-l-4 border-l-orange-500' : ''
                }`}
                onClick={() => navigate(`/farmers/${item.farmer.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{item.farmer.data.name}</h3>
                      {item.balance > 0 && (
                        <Badge variant="warning" size="sm">
                          {t('reports.due')}
                        </Badge>
                      )}
                    </div>

                    {item.farmer.data.village && (
                      <p className="text-sm text-gray-500">{item.farmer.data.village}</p>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                      <div>
                        <p className="text-gray-500">{t('reports.collected')}</p>
                        <p className="font-semibold">{item.totalLiters.toFixed(1)}L</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t('reports.value')}</p>
                        <p className="font-semibold">{formatCurrency(item.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t('reports.paid')}</p>
                        <p className="font-semibold text-green-600">{formatCurrency(item.totalPaid)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">{t('reports.balance')}</p>
                    <p className={`text-xl font-bold ${item.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(item.balance)}
                    </p>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto mt-2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
