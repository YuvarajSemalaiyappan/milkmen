import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, MapPin, ChevronRight, Users } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { ShiftToggle, RouteFilter } from '@/components/common'
import { useAppStore, useRouteStore } from '@/store'
import { routesApi } from '@/services/api'
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
          setFarmers(response.data.routeFarmers)
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

  const filteredFarmers = selectedAreaId
    ? farmers.filter((rf) => rf.areaId === selectedAreaId)
    : farmers

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
              {selectedAreaId ? t('areas.noFarmersAssigned') : t('routes.noFarmersAssigned')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredFarmers.length} {t('farmer.farmersFound')}
            </p>
            {filteredFarmers.map((rf) => (
              <Card
                key={rf.id}
                className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                onClick={() => navigate(`/collect/add?farmerId=${rf.farmer.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {rf.farmer.name}
                    </p>
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
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
