import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserCircle, IndianRupee, ChevronRight, Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button, Badge, Input } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useCustomers, useDeliveries, usePayments } from '@/hooks'
import { formatCurrency, getToday } from '@/utils'
import type { LocalCustomer } from '@/types'

interface CustomerDue {
  customer: LocalCustomer
  totalLiters: number
  totalAmount: number
  totalPaid: number
  balance: number
}

export function CustomerDuesReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeCustomers } = useCustomers()
  const { getDeliveriesByCustomer } = useDeliveries()
  const { getCustomerPaymentsSummary } = usePayments()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30) // Last 30 days
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(getToday())
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCustomerDues()
  }, [activeCustomers, startDate, endDate])

  const loadCustomerDues = async () => {
    setIsLoading(true)
    try {
      const dues: CustomerDue[] = await Promise.all(
        activeCustomers.map(async (customer) => {
          const deliveries = await getDeliveriesByCustomer(customer.id, startDate, endDate)
          const paymentsSummary = await getCustomerPaymentsSummary(customer.id, startDate, endDate)

          const deliveredItems = deliveries.filter((d) => d.data.status === 'DELIVERED')
          const totalLiters = deliveredItems.reduce((sum, d) => sum + Number(d.data.quantity), 0)
          const totalAmount = deliveredItems.reduce((sum, d) => sum + Number(d.data.totalAmount), 0)
          const totalPaid = paymentsSummary.totalPayments

          return {
            customer,
            totalLiters,
            totalAmount,
            totalPaid,
            balance: totalAmount - totalPaid
          }
        })
      )

      // Sort by balance (highest first)
      dues.sort((a, b) => b.balance - a.balance)
      setCustomerDues(dues)
    } finally {
      setIsLoading(false)
    }
  }

  const totalDue = customerDues.reduce((sum, c) => sum + Math.max(0, c.balance), 0)
  const totalLiters = customerDues.reduce((sum, c) => sum + c.totalLiters, 0)
  const totalAmount = customerDues.reduce((sum, c) => sum + c.totalAmount, 0)

  return (
    <AppShell title={t('reports.customerDues')} showBack>
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

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}...
          </div>
        )}

        {/* Customer List */}
        {!isLoading && customerDues.length === 0 ? (
          <EmptyState
            icon={<UserCircle className="w-16 h-16" />}
            title={t('reports.noData')}
            description={t('reports.noDeliveriesInPeriod')}
          />
        ) : (
          <div className="space-y-3">
            {customerDues.map((item) => (
              <Card
                key={item.customer.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  item.balance > 0 ? 'border-l-4 border-l-red-500' : ''
                }`}
                onClick={() => navigate(`/customers/${item.customer.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{item.customer.data.name}</h3>
                      {item.balance > 0 && (
                        <Badge variant="error" size="sm">
                          {t('reports.due')}
                        </Badge>
                      )}
                    </div>

                    {item.customer.data.address && (
                      <p className="text-sm text-gray-500">{item.customer.data.address}</p>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                      <div>
                        <p className="text-gray-500">{t('reports.delivered')}</p>
                        <p className="font-semibold">{item.totalLiters.toFixed(1)}L</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t('reports.value')}</p>
                        <p className="font-semibold">{formatCurrency(item.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t('reports.received')}</p>
                        <p className="font-semibold text-green-600">{formatCurrency(item.totalPaid)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">{t('reports.balance')}</p>
                    <p className={`text-xl font-bold ${item.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
