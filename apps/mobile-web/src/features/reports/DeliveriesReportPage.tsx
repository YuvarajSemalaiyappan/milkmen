import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Truck, Calendar, UserCircle, ChevronRight, Filter, Download } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Input, Badge } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useCustomers } from '@/hooks'
import { reportsApi, deliveriesApi } from '@/services/api'
import { formatCurrency, formatDate, getToday, exportToExcel } from '@/utils'
import type { Customer, Delivery, ApiResponse } from '@/types'

interface DeliveryWithCustomer extends Delivery {
  customerName: string
  customerAddress?: string
}

interface CustomerSummary {
  id: string
  name: string
  address: string | null
  liters: number
  amount: number
  count: number
}

interface ReportData {
  from: string
  to: string
  deliveries: (Delivery & { customer: { id: string; name: string; address: string | null } })[]
  byCustomer: CustomerSummary[]
  totals: { liters: number; amount: number; count: number }
}

const PAGE_SIZE = 50

export function DeliveriesReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customerIdParam = searchParams.get('customerId')
  const { customers: allCustomers } = useCustomers()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(getToday())
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerIdParam || '')
  const [deliveries, setDeliveries] = useState<DeliveryWithCustomer[]>([])
  const [customerSummaries, setCustomerSummaries] = useState<CustomerSummary[]>([])
  const [totals, setTotals] = useState({ liters: 0, amount: 0, count: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'summary'>(customerIdParam ? 'list' : 'summary')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const isPersonMode = !!customerIdParam

  const personName = useMemo(() => {
    if (!customerIdParam) return ''
    const customer = allCustomers.find(c => c.id === customerIdParam)
    return customer?.name || ''
  }, [customerIdParam, allCustomers])

  useEffect(() => {
    loadDeliveries()
  }, [startDate, endDate, selectedCustomerId])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [startDate, endDate, selectedCustomerId])

  const loadDeliveries = async () => {
    setIsLoading(true)
    try {
      const effectiveCustomerId = selectedCustomerId || customerIdParam || undefined

      if (isPersonMode) {
        // Person mode: fetch all statuses for this customer
        const response = await deliveriesApi.list({
          from: startDate,
          to: endDate,
          customerId: effectiveCustomerId
        }) as ApiResponse<Delivery[]>
        if (response.success && response.data) {
          const customerMap = new Map<string, Customer>()
          allCustomers.forEach(c => customerMap.set(c.id, c))

          const items: DeliveryWithCustomer[] = response.data.map(d => {
            const customer = customerMap.get(d.customerId)
            return {
              ...d,
              customerName: customer?.name || t('common.unknown'),
              customerAddress: customer?.address
            }
          }).sort((a, b) => b.date.localeCompare(a.date))

          setDeliveries(items)
          const totalLiters = items.reduce((sum, d) => sum + Number(d.quantity), 0)
          const totalAmount = items.reduce((sum, d) => sum + Number(d.totalAmount), 0)
          setTotals({ liters: totalLiters, amount: totalAmount, count: items.length })
          setCustomerSummaries([])
        }
      } else {
        // Report mode: use the report endpoint (only DELIVERED status)
        const response = await reportsApi.deliveries(startDate, endDate, effectiveCustomerId) as ApiResponse<ReportData>
        if (response.success && response.data) {
          const data = response.data

          // Map deliveries for list view
          const items: DeliveryWithCustomer[] = data.deliveries.map(d => ({
            ...d,
            customerName: d.customer?.name || t('common.unknown'),
            customerAddress: d.customer?.address
          }))

          setDeliveries(items)
          setCustomerSummaries(data.byCustomer)
          setTotals(data.totals)
        }
      }
    } catch (error) {
      console.error('Failed to load deliveries report:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const avgRate = totals.liters > 0 ? totals.amount / totals.liters : 0

  const visibleDeliveries = deliveries.slice(0, visibleCount)
  const hasMore = visibleCount < deliveries.length

  const handleExport = () => {
    const rows = deliveries.map(d => ({
      Date: formatDate(d.date),
      Shift: d.shift,
      Customer: d.customerName,
      'Quantity (L)': Number(d.quantity),
      'Rate/L': Number(d.ratePerLiter),
      Total: Number(d.totalAmount),
      Status: d.status,
      Notes: d.notes || ''
    }))
    const name = personName || 'Deliveries'
    exportToExcel(rows, `${name}_${startDate}_${endDate}`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge size="sm" variant="success">{t('delivery.delivered')}</Badge>
      case 'SKIPPED':
        return <Badge size="sm" variant="warning">{t('delivery.skipped')}</Badge>
      case 'CANCELLED':
        return <Badge size="sm" variant="error">{t('delivery.cancelled')}</Badge>
      case 'PENDING':
        return <Badge size="sm" variant="default">{t('delivery.pending')}</Badge>
      default:
        return null
    }
  }

  const title = isPersonMode && personName
    ? `${personName} - ${t('reports.deliveries')}`
    : t('reports.deliveries')

  return (
    <AppShell title={title} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Date Range + Export */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t('reports.dateRange')}
            </h3>
            {deliveries.length > 0 && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1 text-sm text-pink-600 font-medium"
              >
                <Download className="w-4 h-4" />
                {t('reports.exportExcel')}
              </button>
            )}
          </div>
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

        {/* Customer Filter - hidden in person mode */}
        {!isPersonMode && (
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
                  {customer.name} {customer.address ? `(${customer.address})` : ''}
                </option>
              ))}
            </select>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-pink-600">{totals.liters.toFixed(1)}L</p>
            <p className="text-xs text-gray-500">{t('reports.totalLiters')}</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-green-600">{formatCurrency(totals.amount)}</p>
            <p className="text-xs text-gray-500">{t('reports.totalAmount')}</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-blue-600">{formatCurrency(avgRate)}/L</p>
            <p className="text-xs text-gray-500">{t('reports.avgRate')}</p>
          </Card>
        </div>

        {/* View Toggle - hidden in person mode */}
        {!isPersonMode && (
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
        )}

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
                key={summary.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/customers/${summary.id}`)}
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
                    <p className="font-bold text-pink-600">{summary.liters.toFixed(1)}L</p>
                    <p className="text-green-600">{formatCurrency(summary.amount)}</p>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : !isLoading ? (
          <div className="space-y-3">
            {visibleDeliveries.map((delivery) => (
              <Card
                key={delivery.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/deliver/${delivery.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-100 rounded-lg">
                      <Truck className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{delivery.customerName}</h3>
                      <p className="text-sm text-gray-500">
                        {formatDate(delivery.date)} - {t(`shifts.${delivery.shift.toLowerCase()}`)}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isPersonMode && getStatusBadge(delivery.status)}
                        {delivery.isSubscription && (
                          <Badge variant="info" size="sm">{t('delivery.subscriptionDelivery')}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="font-bold text-gray-900">{Number(delivery.quantity).toFixed(1)}L</p>
                      <p className="text-sm text-gray-500">
                        @ {formatCurrency(delivery.ratePerLiter)}/L
                      </p>
                      <p className="font-semibold text-green-600">{formatCurrency(delivery.totalAmount)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </Card>
            ))}

            {/* Pagination */}
            {hasMore && (
              <div className="text-center pt-2">
                <p className="text-sm text-gray-500 mb-2">
                  {t('reports.showingCount', { count: visibleCount, total: deliveries.length })}
                </p>
                <button
                  onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                  className="px-6 py-2 bg-pink-100 text-pink-700 rounded-lg font-medium"
                >
                  {t('reports.loadMore')}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
