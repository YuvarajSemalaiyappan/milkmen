import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Search } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { routesApi } from '@/services/api'
import type { ApiResponse } from '@/types'

interface RouteFarmerItem {
  id: string
  farmerId: string
  areaId?: string | null
  sortOrder: number
  farmer: { id: string; name: string; phone?: string; village?: string }
}

interface RouteDetailData {
  id: string
  routeFarmers: RouteFarmerItem[]
}

export function AreaAssignFarmersPage() {
  const { t } = useTranslation()
  const { routeId, areaId } = useParams<{ routeId: string; areaId: string }>()
  const navigate = useNavigate()
  const [routeFarmers, setRouteFarmers] = useState<RouteFarmerItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!routeId) return
    try {
      setIsLoading(true)
      const response = await routesApi.get(routeId) as ApiResponse<RouteDetailData>
      if (response.success && response.data) {
        setRouteFarmers(response.data.routeFarmers)
        // Pre-select farmers already assigned to this area
        const alreadyAssigned = response.data.routeFarmers
          .filter((rf) => rf.areaId === areaId)
          .map((rf) => rf.farmerId)
        setSelectedIds(new Set(alreadyAssigned))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [routeId, areaId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleFarmer = (farmerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(farmerId)) {
        next.delete(farmerId)
      } else {
        next.add(farmerId)
      }
      return next
    })
  }

  // Only show farmers not assigned to another area, or already in this area
  const eligibleFarmers = routeFarmers.filter(
    (rf) => !rf.areaId || rf.areaId === areaId
  )

  const filteredFarmers = searchQuery
    ? eligibleFarmers.filter(
        (rf) =>
          rf.farmer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          rf.farmer.phone?.includes(searchQuery) ||
          rf.farmer.village?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : eligibleFarmers

  const handleSave = async () => {
    if (!routeId) return
    try {
      setIsSaving(true)
      const allFarmerIds = routeFarmers.map((rf) => rf.farmerId)
      const sortOrders: Record<string, number> = {}
      const areaIds: Record<string, string> = {}

      routeFarmers.forEach((rf) => {
        sortOrders[rf.farmerId] = rf.sortOrder
        if (selectedIds.has(rf.farmerId)) {
          areaIds[rf.farmerId] = areaId!
        } else if (rf.areaId && rf.areaId !== areaId) {
          areaIds[rf.farmerId] = rf.areaId
        }
      })

      await routesApi.assignFarmers(routeId, allFarmerIds, sortOrders, areaIds)
      navigate(`/routes/${routeId}/areas/${areaId}`)
    } catch (error) {
      console.error('Failed to assign farmers:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell title={t('areas.assignFarmers')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}
          </div>
        ) : (
          <>
            <Input
              placeholder={t('farmer.searchFarmers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedIds.size} {t('routes.selected')}
            </p>

            <div className="space-y-2">
              {filteredFarmers.map((rf) => (
                <Card
                  key={rf.id}
                  className={`cursor-pointer transition-colors ${
                    selectedIds.has(rf.farmerId)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : ''
                  }`}
                  onClick={() => toggleFarmer(rf.farmerId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {rf.farmer.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {[rf.farmer.village, rf.farmer.phone]
                          .filter(Boolean)
                          .join(' - ')}
                      </p>
                    </div>
                    {selectedIds.has(rf.farmerId) && (
                      <Check className="w-5 h-5 text-primary-500" />
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {filteredFarmers.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-4">
                {t('farmer.noFarmers')}
              </p>
            )}

            <div className="flex gap-3 pt-4 sticky bottom-4">
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                fullWidth
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                fullWidth
              >
                {t('common.save')} ({selectedIds.size})
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
