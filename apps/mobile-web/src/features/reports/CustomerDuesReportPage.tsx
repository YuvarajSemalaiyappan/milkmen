import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserCircle, IndianRupee, ChevronRight, Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button, Badge, Input } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useCustomers } from '@/hooks'
import { deliveriesApi, paymentsApi } from '@/services/api'
import { formatCurrency, getToday } from '@/utils'
import type { Customer, Delivery, Payment, ApiResponse } from '@/types'

interface CustomerDue {
  customer: Customer
  totalLiters: number
  totalAmount: number
  totalPaid: number
  balance: number
}

export function CustomerDuesReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeCustomers } = useCustomers()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30) // Last 30 days
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(getToday())
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (activeCustomers.length > 0) {
      loadCustomerDues()
    }
  }, [activeCustomers, startDate, endDate])

  const loadCustomerDues = async () => {
    setIsLoading(true)
    try {
      // 2 bulk API calls instead of N+1 per customer
      const [deliveriesRes, paymentsRes] = await Promise.all([
        deliveriesApi.list({ from: startDate, to: endDate }) as Promise<ApiResponse<Delivery[]>>,
        paymentsApi.list({ from: startDate, to: endDate }) as Promise<ApiResponse<Payment[]>>
      ])

      const allDeliveries = deliveriesRes.success && deliveriesRes.data ? deliveriesRes.data : []
      const allPayments = paymentsRes.success && paymentsRes.data ? paymentsRes.data : []

      // Group deliveries by customer
      const deliveryByCustomer = new Map<string, { liters: number; amount: number }>()
      allDeliveries
        .filter(d => d.status === 'DELIVERED')
        .forEach(d => {
          const existing = deliveryByCustomer.get(d.customerId) || { liters: 0, amount: 0 }
          existing.liters += Number(d.quantity)
          existing.amount += Number(d.totalAmount)
          deliveryByCustomer.set(d.customerId, existing)
        })

      // Group payments by customer
      const paymentByCustomer = new Map<string, number>()
      allPayments
        .filter(p => p.customerId && (p.type === 'RECEIVED_FROM_CUSTOMER' || p.type === 'ADVANCE_FROM_CUSTOMER'))
        .forEach(p => {
          const existing = paymentByCustomer.get(p.customerId!) || 0
          paymentByCustomer.set(p.customerId!, existing + Number(p.amount))
        })

      // Build dues list
      const dues: CustomerDue[] = activeCustomers.map(customer => {
        const deliveryData = deliveryByCustomer.get(customer.id) || { liters: 0, amount: 0 }
        const totalPaid = paymentByCustomer.get(customer.id) || 0
        return {
          customer,
          totalLiters: deliveryData.liters,
          totalAmount: deliveryData.amount,
          totalPaid,
          balance: deliveryData.amount - totalPaid
        }
      })

      // Sort by balance (highest first)
      dues.sort((a, b) => b.balance - a.balance)
      setCustomerDues(dues)
    } catch (error) {
      console.error('Failed to load customer dues:', error)
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
                      <h3 className="font-semibold">{item.customer.name}</h3>
                      {item.balance > 0 && (
                        <Badge variant="error" size="sm">
                          {t('reports.due')}
                        </Badge>
                      )}
                    </div>

                    {item.customer.address && (
                      <p className="text-sm text-gray-500">{item.customer.address}</p>
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
