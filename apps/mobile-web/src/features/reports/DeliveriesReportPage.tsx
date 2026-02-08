import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Truck, Calendar, UserCircle, ChevronRight, Filter } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Input, Badge } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useCustomers, useDeliveries } from '@/hooks'
import { formatCurrency, formatDate, getToday } from '@/utils'
import type { LocalCustomer, LocalDelivery } from '@/types'

interface DeliveryWithCustomer extends LocalDelivery {
  customerName: string
  customerAddress?: string
}

interface CustomerSummary {
  customerId: string
  name: string
  address?: string
  totalLiters: number
  totalAmount: number
  count: number
}

export function DeliveriesReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { customers: allCustomers } = useCustomers()
  const { getDeliveriesByDateRange } = useDeliveries()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(getToday())
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [deliveries, setDeliveries] = useState<DeliveryWithCustomer[]>([])
  const [customerSummaries, setCustomerSummaries] = useState<CustomerSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'summary'>('summary')

  const getCustomerMap = () => {
    const map = new Map<string, LocalCustomer>()
    allCustomers.forEach(c => map.set(c.id, c))
    return map
  }

  useEffect(() => {
    loadDeliveries()
  }, [startDate, endDate, selectedCustomerId, allCustomers.length])

  const loadDeliveries = async () => {
    setIsLoading(true)
    try {
      let allDeliveries = await getDeliveriesByDateRange(startDate, endDate)

      // Filter to only delivered items
      allDeliveries = allDeliveries.filter(d => d.data.status === 'DELIVERED')

      // Filter by customer if selected
      if (selectedCustomerId) {
        allDeliveries = allDeliveries.filter(d => d.data.customerId === selectedCustomerId)
      }

      const customerMap = getCustomerMap()

      // Add customer names to deliveries
      const deliveriesWithCustomers: DeliveryWithCustomer[] = allDeliveries.map(d => {
        const customer = customerMap.get(d.data.customerId)
        return {
          ...d,
          customerName: customer?.data.name || t('common.unknown'),
          customerAddress: customer?.data.address
        }
      }).sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

      setDeliveries(deliveriesWithCustomers)

      // Calculate customer summaries
      const summaryMap = new Map<string, CustomerSummary>()
      allDeliveries.forEach(d => {
        const customerId = d.data.customerId
        const customer = customerMap.get(customerId)

        if (!summaryMap.has(customerId)) {
          summaryMap.set(customerId, {
            customerId,
            name: customer?.data.name || t('common.unknown'),
            address: customer?.data.address,
            totalLiters: 0,
            totalAmount: 0,
            count: 0
          })
        }

        const summary = summaryMap.get(customerId)!
        summary.totalLiters += Number(d.data.quantity)
        summary.totalAmount += Number(d.data.totalAmount)
        summary.count++
      })

      const summaries = Array.from(summaryMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)

      setCustomerSummaries(summaries)
    } finally {
      setIsLoading(false)
    }
  }

  const totalLiters = deliveries.reduce((sum, d) => sum + Number(d.data.quantity), 0)
  const totalAmount = deliveries.reduce((sum, d) => sum + Number(d.data.totalAmount), 0)
  const avgRate = totalLiters > 0 ? totalAmount / totalLiters : 0

  return (
    <AppShell title={t('reports.deliveries')} showBack>
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

        {/* Customer Filter */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-700">{t('reports.filterByCustomer')}</span>
          </div>
          <select
            className="w-full p-3 border rounded-lg bg-white"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">{t('reports.allCustomers')}</option>
            {allCustomers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.data.name} {customer.data.address ? `(${customer.data.address})` : ''}
              </option>
            ))}
          </select>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-pink-600">{totalLiters.toFixed(1)}L</p>
            <p className="text-xs text-gray-500">{t('reports.totalLiters')}</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-gray-500">{t('reports.totalAmount')}</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-blue-600">{formatCurrency(avgRate)}/L</p>
            <p className="text-xs text-gray-500">{t('reports.avgRate')}</p>
          </Card>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              viewMode === 'summary'
                ? 'bg-pink-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setViewMode('summary')}
          >
            {t('reports.byCustomer')}
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-pink-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setViewMode('list')}
          >
            {t('reports.allEntries')}
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}...
          </div>
        )}

        {/* Content */}
        {!isLoading && deliveries.length === 0 ? (
          <EmptyState
            icon={<Truck className="w-16 h-16" />}
            title={t('reports.noData')}
            description={t('reports.noDeliveriesInPeriod')}
          />
        ) : !isLoading && viewMode === 'summary' ? (
          <div className="space-y-3">
            {customerSummaries.map((summary) => (
              <Card
                key={summary.customerId}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/customers/${summary.customerId}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-100 rounded-lg">
                      <UserCircle className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{summary.name}</h3>
                      {summary.address && (
                        <p className="text-sm text-gray-500">{summary.address}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        {summary.count} {t('reports.entries')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-pink-600">{summary.totalLiters.toFixed(1)}L</p>
                    <p className="text-green-600">{formatCurrency(summary.totalAmount)}</p>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : !isLoading ? (
          <div className="space-y-3">
            {deliveries.map((delivery) => (
              <Card key={delivery.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-100 rounded-lg">
                      <Truck className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{delivery.customerName}</h3>
                      <p className="text-sm text-gray-500">
                        {formatDate(delivery.data.date)} - {t(`shifts.${delivery.data.shift.toLowerCase()}`)}
                      </p>
                      {delivery.data.isSubscription && (
                        <Badge variant="info" size="sm">{t('delivery.subscriptionDelivery')}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{Number(delivery.data.quantity).toFixed(1)}L</p>
                    <p className="text-sm text-gray-500">
                      @ {formatCurrency(delivery.data.ratePerLiter)}/L
                    </p>
                    <p className="font-semibold text-green-600">{formatCurrency(delivery.data.totalAmount)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
