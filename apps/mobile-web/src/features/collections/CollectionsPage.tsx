import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, MapPin, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { ShiftToggle, RouteFilter, SortableList, ShiftBadge } from '@/components/common'
import { useAppStore, useRouteStore } from '@/store'
import { useSortOrder } from '@/hooks/useSortOrder'
import { collectionsApi } from '@/services/api'
import { useFarmers, useRouteFarmerIds } from '@/hooks'
import { getToday } from '@/utils/format'
import type { ApiResponse, Collection } from '@/types'
import { formatCurrency } from '@/utils'

// Milk collection for today and the chosen shift: farmers still to collect at the top (drag to
// reorder), entries already collected below. Works with or without a route; the route/area filter
// narrows both lists. Same layout as the phone app's Collect tab.
export function CollectionsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const { activeFarmers, isLoading: farmersLoading } = useFarmers()
  const { farmerIds: routeFarmerIds } = useRouteFarmerIds(selectedRouteId, selectedAreaId)
  const { applySortOrder, saveSortOrder } = useSortOrder('farmer')

  // Today's collections (the whole day: a day is a bounded list)
  // The list endpoint includes each entry's farmer name
  const [todayCollections, setTodayCollections] = useState<(Collection & { farmer?: { name: string } })[] | null>(null)
  useEffect(() => {
    let cancelled = false
    collectionsApi
      .list({ date: getToday() })
      .then((res) => {
        const data = (res as ApiResponse<(Collection & { farmer?: { name: string } })[]>).data
        if (!cancelled) setTodayCollections(data ?? [])
      })
      .catch((error) => {
        console.error('Failed to fetch today collections:', error)
        if (!cancelled) setTodayCollections([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const inScope = useCallback((farmerId: string) => !routeFarmerIds || routeFarmerIds.has(farmerId), [routeFarmerIds])

  // Collected this shift, in the chosen route/area
  const done = useMemo(
    () => (todayCollections ?? []).filter((c) => c.shift === currentShift && inScope(c.farmerId)),
    [todayCollections, currentShift, inScope]
  )

  // Farmers in the route/area who collect in this shift and have no entry yet
  const pendingFarmers = useMemo(() => {
    const doneIds = new Set(done.map((c) => c.farmerId))
    return activeFarmers.filter(
      (f) =>
        inScope(f.id) &&
        (currentShift === 'MORNING' ? f.collectAM !== false : f.collectPM !== false) &&
        !doneIds.has(f.id)
    )
  }, [activeFarmers, done, currentShift, inScope])

  const farmerMap = useMemo(() => new Map(pendingFarmers.map((f) => [f.id, f])), [pendingFarmers])
  const sortedFarmerIds = useMemo(
    () => applySortOrder(pendingFarmers.map((f) => ({ id: f.id }))).map((i) => i.id),
    [pendingFarmers, applySortOrder]
  )
  const isLoading = farmersLoading || todayCollections === null

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

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
        ) : (
          <>
            {/* Still to collect (drag to reorder) */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                {t('collection.toCollect')} ({pendingFarmers.length})
              </h3>
              {pendingFarmers.length === 0 ? (
                <p className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">{t('collection.allCompleted')}</p>
              ) : (
                <SortableList
                  items={sortedFarmerIds}
                  onReorder={handleReorder}
                  renderItem={(id) => {
                    const farmer = farmerMap.get(id)
                    if (!farmer) return null
                    const qty = currentShift === 'MORNING' ? farmer.subscriptionQtyAM : farmer.subscriptionQtyPM
                    return (
                      <Card
                        className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                        onClick={() => navigate(`/collect/add?farmerId=${farmer.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{farmer.name}</p>
                              <ShiftBadge shift={currentShift} label={qty ? `${qty}L` : undefined} />
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                              {farmer.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {farmer.phone}
                                </span>
                              )}
                              {farmer.village && (
                                <span className="flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  {farmer.village}
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
              )}
            </div>

            {/* Already collected */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                {t('collection.collectedList')} ({done.length})
              </h3>
              {done.length === 0 ? (
                <p className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">{t('collection.noCollections')}</p>
              ) : (
                <Card padding="none">
                  {done.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/collect/${c.id}`)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left border-b last:border-b-0 border-gray-100 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {c.farmer?.name ?? activeFarmers.find((f) => f.id === c.farmerId)?.name ?? t('common.unknown')}
                          </p>
                          <ShiftBadge shift={c.shift} />
                        </div>
                        <p className="text-sm text-gray-500">
                          {Number(c.quantity)} L × ₹{Number(c.ratePerLiter).toFixed(2)}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white ml-2">{formatCurrency(Number(c.totalAmount))}</span>
                    </button>
                  ))}
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
