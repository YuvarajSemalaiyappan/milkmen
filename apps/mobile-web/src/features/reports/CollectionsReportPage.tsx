import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Milk, Calendar, User, ChevronRight, Filter, Download } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Input, Badge } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useFarmers } from '@/hooks'
import { reportsApi, collectionsApi, paymentsApi } from '@/services/api'
import { formatCurrency, formatDate, getToday, exportToExcel, isEntryPaid } from '@/utils'
import type { Farmer, Collection, Payment, ApiResponse } from '@/types'
import type { PaidPeriodPayment } from '@/utils/paymentPeriod'

interface CollectionWithFarmer extends Collection {
  farmerName: string
  farmerVillage?: string
}

interface FarmerSummary {
  id: string
  name: string
  village: string | null
  liters: number
  amount: number
  count: number
}

interface ReportData {
  from: string
  to: string
  collections: (Collection & { farmer: { id: string; name: string; village: string | null } })[]
  byFarmer: FarmerSummary[]
  totals: { liters: number; amount: number; count: number }
}

const PAGE_SIZE = 50

export function CollectionsReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const farmerIdParam = searchParams.get('farmerId')
  const { farmers: allFarmers } = useFarmers()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(getToday())
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>(farmerIdParam || '')
  const [collections, setCollections] = useState<CollectionWithFarmer[]>([])
  const [farmerSummaries, setFarmerSummaries] = useState<FarmerSummary[]>([])
  const [totals, setTotals] = useState({ liters: 0, amount: 0, count: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'summary'>(farmerIdParam ? 'list' : 'summary')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [paymentsByFarmer, setPaymentsByFarmer] = useState<Map<string, PaidPeriodPayment[]>>(new Map())

  const isPersonMode = !!farmerIdParam

  const personName = useMemo(() => {
    if (!farmerIdParam) return ''
    const farmer = allFarmers.find(f => f.id === farmerIdParam)
    return farmer?.name || ''
  }, [farmerIdParam, allFarmers])

  useEffect(() => {
    loadCollections()
    loadPaidPeriods()
  }, [startDate, endDate, selectedFarmerId])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [startDate, endDate, selectedFarmerId])

  const loadPaidPeriods = async () => {
    try {
      const effectiveFarmerId = selectedFarmerId || farmerIdParam || undefined
      const response = await paymentsApi.list(
        effectiveFarmerId ? { farmerId: effectiveFarmerId } : {}
      ) as ApiResponse<Payment[]>
      if (!response.success || !response.data) {
        setPaymentsByFarmer(new Map())
        return
      }

      const grouped = new Map<string, PaidPeriodPayment[]>()
      response.data
        .filter(p => p.farmerId && p.periodFromDate && p.periodToDate)
        .forEach(p => {
          const arr = grouped.get(p.farmerId!) || []
          arr.push({
            periodFromDate: p.periodFromDate,
            periodToDate: p.periodToDate,
            periodFromShift: p.periodFromShift,
            periodToShift: p.periodToShift,
            createdAt: p.createdAt
          })
          grouped.set(p.farmerId!, arr)
        })
      setPaymentsByFarmer(grouped)
    } catch (error) {
      console.error('Failed to load payment periods:', error)
    }
  }

  const isCollectionPaid = (c: CollectionWithFarmer) => {
    const payments = paymentsByFarmer.get(c.farmerId)
    if (!payments || payments.length === 0) return false
    return isEntryPaid(c.date, c.shift, c.createdAt, payments)
  }

  const loadCollections = async () => {
    setIsLoading(true)
    try {
      const effectiveFarmerId = selectedFarmerId || farmerIdParam || undefined

      // Use report endpoint - returns collections with farmer info + summaries
      const response = await reportsApi.collections(startDate, endDate, effectiveFarmerId) as ApiResponse<ReportData>
      if (response.success && response.data) {
        const data = response.data

        const farmerMap = new Map<string, Farmer>()
        allFarmers.forEach(f => farmerMap.set(f.id, f))

        // Map collections for list view
        const items: CollectionWithFarmer[] = data.collections.map(c => ({
          ...c,
          farmerName: c.farmer?.name || farmerMap.get(c.farmerId)?.name || t('common.unknown'),
          farmerVillage: c.farmer?.village || farmerMap.get(c.farmerId)?.village
        }))

        setCollections(items)
        setFarmerSummaries(data.byFarmer)
        setTotals(data.totals)
      }
    } catch (error) {
      console.error('Failed to load collections report:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const avgRate = totals.liters > 0 ? totals.amount / totals.liters : 0

  const visibleCollections = collections.slice(0, visibleCount)
  const hasMore = visibleCount < collections.length

  const handleExport = () => {
    const rows = collections.map(c => ({
      Date: formatDate(c.date),
      Shift: c.shift,
      Farmer: c.farmerName,
      'Quantity (L)': Number(c.quantity),
      'Rate/L': Number(c.ratePerLiter),
      Total: Number(c.totalAmount),
      'Fat %': c.fatPercentage ? Number(c.fatPercentage) : '',
      Notes: c.notes || ''
    }))
    const name = personName || 'Collections'
    exportToExcel(rows, `${name}_${startDate}_${endDate}`)
  }

  const title = isPersonMode && personName
    ? `${personName} - ${t('reports.collections')}`
    : t('reports.collections')

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
            {collections.length > 0 && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1 text-sm text-purple-600 font-medium"
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

        {/* Farmer Filter - hidden in person mode */}
        {!isPersonMode && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-gray-700">{t('reports.filterByFarmer')}</span>
            </div>
            <select
              className="w-full p-3 border rounded-lg bg-white"
              value={selectedFarmerId}
              onChange={(e) => setSelectedFarmerId(e.target.value)}
            >
              <option value="">{t('reports.allFarmers')}</option>
              {allFarmers.map(farmer => (
                <option key={farmer.id} value={farmer.id}>
                  {farmer.name} {farmer.village ? `(${farmer.village})` : ''}
                </option>
              ))}
            </select>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-purple-600">{totals.liters.toFixed(1)}L</p>
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
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
              onClick={() => setViewMode('summary')}
            >
              {t('reports.byFarmer')}
            </button>
            <button
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white'
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
        {!isLoading && collections.length === 0 ? (
          <EmptyState
            icon={<Milk className="w-16 h-16" />}
            title={t('reports.noData')}
            description={t('reports.noCollectionsInPeriod')}
          />
        ) : !isLoading && viewMode === 'summary' ? (
          <div className="space-y-3">
            {farmerSummaries.map((summary) => (
              <Card
                key={summary.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/farmers/${summary.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{summary.name}</h3>
                      {summary.village && (
                        <p className="text-sm text-gray-500">{summary.village}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        {summary.count} {t('reports.entries')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-600">{summary.liters.toFixed(1)}L</p>
                    <p className="text-green-600">{formatCurrency(summary.amount)}</p>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : !isLoading ? (
          <div className="space-y-3">
            {visibleCollections.map((collection) => (
              <Card
                key={collection.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/collect/${collection.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Milk className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{collection.farmerName}</h3>
                        <Badge size="sm" variant={isCollectionPaid(collection) ? 'success' : 'error'}>
                          {isCollectionPaid(collection) ? t('reports.paid') : t('reports.unpaid')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(collection.date)} - {t(`shifts.${collection.shift.toLowerCase()}`)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="font-bold text-gray-900">{Number(collection.quantity).toFixed(1)}L</p>
                      <p className="text-sm text-gray-500">
                        @ {formatCurrency(collection.ratePerLiter)}/L
                      </p>
                      <p className="font-semibold text-green-600">{formatCurrency(collection.totalAmount)}</p>
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
                  {t('reports.showingCount', { count: visibleCount, total: collections.length })}
                </p>
                <button
                  onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                  className="px-6 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium"
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
