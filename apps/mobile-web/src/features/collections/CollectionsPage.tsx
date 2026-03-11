import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Phone, MapPin, ChevronRight, Users, Sun, Moon } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { ShiftToggle, RouteFilter, SortableList } from '@/components/common'
import { useAppStore, useRouteStore } from '@/store'
import { useSortOrder } from '@/hooks/useSortOrder'
import { routesApi } from '@/services/api'
import { db } from '@/db/localDb'
import { getToday } from '@/utils/format'
import type { ApiResponse } from '@/types'

interface RouteFarmerItem {
  id: string
  farmerId: string
  areaId?: string | null
  farmer: {
    id: string
    name: string
    phone?: string
    village?: string
    defaultRate: number
    collectAM?: boolean
    collectPM?: boolean
    subscriptionQtyAM?: number
    subscriptionQtyPM?: number
    isActive: boolean
    balance: number
  }
}

interface RouteDetailData {
  id: string
  routeFarmers: RouteFarmerItem[]
}

export function CollectionsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const [farmers, setFarmers] = useState<RouteFarmerItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { applySortOrder, saveSortOrder } = useSortOrder('farmer')

  // Track which farmers already have a collection today for the current shift
  const completedFarmerIds = useLiveQuery(async () => {
    const today = getToday()
    const todayCollections = await db.collections
      .filter((c) => c.data.date === today && c.data.shift === currentShift)
      .toArray()
    return new Set(todayCollections.map((c) => c.data.farmerId))
  }, [currentShift])

  useEffect(() => {
    if (!selectedRouteId) {
      setFarmers([])
      return
    }

    const fetchRouteFarmers = async () => {
      setIsLoading(true)
      try {
        const response = await routesApi.get(selectedRouteId) as ApiResponse<RouteDetailData>
        if (response.success && response.data) {
          setFarmers(response.data.routeFarmers.filter(rf => rf.farmer.isActive))
        }
      } catch (error) {
        console.error('Failed to fetch route farmers:', error)
        setFarmers([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchRouteFarmers()
  }, [selectedRouteId])

  const areaFilteredFarmers = selectedAreaId
    ? farmers.filter((rf) => rf.areaId === selectedAreaId)
    : farmers

  // Only show farmers who are pending (no collection yet today for this shift)
  const filteredFarmers = areaFilteredFarmers.filter(
    (rf) => !completedFarmerIds?.has(rf.farmer.id)
  )

  const farmerMap = useMemo(() => {
    const map = new Map<string, RouteFarmerItem>()
    filteredFarmers.forEach((rf) => map.set(rf.farmer.id, rf))
    return map
  }, [filteredFarmers])

  const sortedFarmerIds = useMemo(() => {
    const items = filteredFarmers.map((rf) => ({ id: rf.farmer.id }))
    return applySortOrder(items).map((i) => i.id)
  }, [filteredFarmers, applySortOrder])

  const handleReorder = useCallback((newIds: string[]) => {
    saveSortOrder(newIds)
  }, [saveSortOrder])

  return (
    <AppShell title={t('collection.title')}>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Shift Toggle */}
        <ShiftToggle
          value={currentShift}
          onChange={setCurrentShift}
          fullWidth
        />

        {/* Route Filter (includes Area Filter) */}
        <RouteFilter />

        {/* Farmer List */}
        {!selectedRouteId ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('routes.allRoutes')}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t('collection.selectRouteHint')}
            </p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}
          </div>
        ) : filteredFarmers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {areaFilteredFarmers.length > 0
                ? t('collection.allCompleted')
                : selectedAreaId ? t('areas.noFarmersAssigned') : t('routes.noFarmersAssigned')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredFarmers.length} {t('common.pending')} / {areaFilteredFarmers.length} {t('farmer.farmersFound')}
            </p>
            <SortableList
              items={sortedFarmerIds}
              onReorder={handleReorder}
              renderItem={(id) => {
                const rf = farmerMap.get(id)
                if (!rf) return null
                const hasAM = rf.farmer.collectAM !== false
                const hasPM = !!rf.farmer.collectPM
                return (
                  <Card
                    className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                    onClick={() => navigate(`/collect/add?farmerId=${rf.farmer.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {rf.farmer.name}
                          </p>
                          {hasAM && (
                            <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              currentShift === 'MORNING'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              <Sun className="w-3 h-3" />
                              {rf.farmer.subscriptionQtyAM ? `${rf.farmer.subscriptionQtyAM}L` : 'AM'}
                            </span>
                          )}
                          {hasPM && (
                            <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              currentShift === 'EVENING'
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              <Moon className="w-3 h-3" />
                              {rf.farmer.subscriptionQtyPM ? `${rf.farmer.subscriptionQtyPM}L` : 'PM'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          {rf.farmer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {rf.farmer.phone}
                            </span>
                          )}
                          {rf.farmer.village && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {rf.farmer.village}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                  </Card>
                )
              }}
            />
          </div>
        )}
      </div>
    </AppShell>
  )
}
