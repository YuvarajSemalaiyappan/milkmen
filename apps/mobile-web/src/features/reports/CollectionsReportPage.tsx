import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Milk, Calendar, User, ChevronRight, Filter } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Input, Badge } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useFarmers, useCollections } from '@/hooks'
import { formatCurrency, formatDate, getToday } from '@/utils'
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

export function CollectionsReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeFarmers, inactiveFarmers } = useFarmers()
  const allFarmers = [...activeFarmers, ...inactiveFarmers]
  const { getCollectionsByDateRange } = useCollections()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(getToday())
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('')
  const [collections, setCollections] = useState<CollectionWithFarmer[]>([])
  const [farmerSummaries, setFarmerSummaries] = useState<FarmerSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'summary'>('summary')

  const getFarmerMap = () => {
    const map = new Map<string, LocalFarmer>()
    allFarmers.forEach(f => map.set(f.id, f))
    return map
  }

  useEffect(() => {
    loadCollections()
  }, [startDate, endDate, selectedFarmerId, allFarmers.length])

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
        summary.totalLiters += c.data.quantity
        summary.totalAmount += c.data.totalAmount
        summary.count++
      })

      const summaries = Array.from(summaryMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)

      setFarmerSummaries(summaries)
    } finally {
      setIsLoading(false)
    }
  }

  const totalLiters = collections.reduce((sum, c) => sum + c.data.quantity, 0)
  const totalAmount = collections.reduce((sum, c) => sum + c.data.totalAmount, 0)
  const avgRate = totalLiters > 0 ? totalAmount / totalLiters : 0

  return (
    <AppShell title={t('reports.collections')} showBack>
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

        {/* Farmer Filter */}
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

        {/* View Toggle */}
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
            {collections.map((collection) => (
              <Card key={collection.id}>
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
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{collection.data.quantity.toFixed(1)}L</p>
                    <p className="text-sm text-gray-500">
                      @ {formatCurrency(collection.data.ratePerLiter)}/L
                    </p>
                    <p className="font-semibold text-green-600">{formatCurrency(collection.data.totalAmount)}</p>
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
