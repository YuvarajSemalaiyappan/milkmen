import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Milk, Calendar, User, ChevronRight, Filter, Download } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Input, Badge } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useFarmers, useCollections } from '@/hooks'
import { formatCurrency, formatDate, getToday, exportToExcel } from '@/utils'
import type { LocalFarmer, LocalCollection } from '@/types'

interface CollectionWithFarmer extends LocalCollection {
  farmerName: string
  farmerVillage?: string
}

interface FarmerSummary {
  farmerId: string
  name: string
  village?: string
  totalLiters: number
  totalAmount: number
  count: number
}

const PAGE_SIZE = 50

export function CollectionsReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const farmerIdParam = searchParams.get('farmerId')
  const { farmers: allFarmers } = useFarmers()
  const { getCollectionsByDateRange } = useCollections()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(getToday())
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>(farmerIdParam || '')
  const [collections, setCollections] = useState<CollectionWithFarmer[]>([])
  const [farmerSummaries, setFarmerSummaries] = useState<FarmerSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'summary'>(farmerIdParam ? 'list' : 'summary')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const isPersonMode = !!farmerIdParam

  const personName = useMemo(() => {
    if (!farmerIdParam) return ''
    const farmer = allFarmers.find(f => f.id === farmerIdParam)
    return farmer?.data.name || ''
  }, [farmerIdParam, allFarmers])

  const getFarmerMap = () => {
    const map = new Map<string, LocalFarmer>()
    allFarmers.forEach(f => map.set(f.id, f))
    return map
  }

  useEffect(() => {
    loadCollections()
  }, [startDate, endDate, selectedFarmerId, allFarmers.length])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [startDate, endDate, selectedFarmerId])

  const loadCollections = async () => {
    setIsLoading(true)
    try {
      let allCollections = await getCollectionsByDateRange(startDate, endDate)

      // Filter by farmer if selected
      if (selectedFarmerId) {
        allCollections = allCollections.filter(c => c.data.farmerId === selectedFarmerId)
      }

      const farmerMap = getFarmerMap()

      // Add farmer names to collections
      const collectionsWithFarmers: CollectionWithFarmer[] = allCollections.map(c => {
        const farmer = farmerMap.get(c.data.farmerId)
        return {
          ...c,
          farmerName: farmer?.data.name || t('common.unknown'),
          farmerVillage: farmer?.data.village
        }
      }).sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

      setCollections(collectionsWithFarmers)

      // Calculate farmer summaries
      const summaryMap = new Map<string, FarmerSummary>()
      allCollections.forEach(c => {
        const farmerId = c.data.farmerId
        const farmer = farmerMap.get(farmerId)

        if (!summaryMap.has(farmerId)) {
          summaryMap.set(farmerId, {
            farmerId,
            name: farmer?.data.name || t('common.unknown'),
            village: farmer?.data.village,
            totalLiters: 0,
            totalAmount: 0,
            count: 0
          })
        }

        const summary = summaryMap.get(farmerId)!
        summary.totalLiters += Number(c.data.quantity)
        summary.totalAmount += Number(c.data.totalAmount)
        summary.count++
      })

      const summaries = Array.from(summaryMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)

      setFarmerSummaries(summaries)
    } finally {
      setIsLoading(false)
    }
  }

  const totalLiters = collections.reduce((sum, c) => sum + Number(c.data.quantity), 0)
  const totalAmount = collections.reduce((sum, c) => sum + Number(c.data.totalAmount), 0)
  const avgRate = totalLiters > 0 ? totalAmount / totalLiters : 0

  const visibleCollections = collections.slice(0, visibleCount)
  const hasMore = visibleCount < collections.length

  const handleExport = () => {
    const rows = collections.map(c => ({
      Date: formatDate(c.data.date),
      Shift: c.data.shift,
      Farmer: c.farmerName,
      'Quantity (L)': Number(c.data.quantity),
      'Rate/L': Number(c.data.ratePerLiter),
      Total: Number(c.data.totalAmount),
      'Fat %': c.data.fatPercentage ? Number(c.data.fatPercentage) : '',
      Notes: c.data.notes || ''
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
                  {farmer.data.name} {farmer.data.village ? `(${farmer.data.village})` : ''}
                </option>
              ))}
            </select>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center p-3">
            <p className="text-xl font-bold text-purple-600">{totalLiters.toFixed(1)}L</p>
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
                key={summary.farmerId}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/farmers/${summary.farmerId}`)}
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
                    <p className="font-bold text-purple-600">{summary.totalLiters.toFixed(1)}L</p>
                    <p className="text-green-600">{formatCurrency(summary.totalAmount)}</p>
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
                      <h3 className="font-semibold text-gray-900">{collection.farmerName}</h3>
                      <p className="text-sm text-gray-500">
                        {formatDate(collection.data.date)} - {t(`shifts.${collection.data.shift.toLowerCase()}`)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="font-bold text-gray-900">{Number(collection.data.quantity).toFixed(1)}L</p>
                      <p className="text-sm text-gray-500">
                        @ {formatCurrency(collection.data.ratePerLiter)}/L
                      </p>
                      <p className="font-semibold text-green-600">{formatCurrency(collection.data.totalAmount)}</p>
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
