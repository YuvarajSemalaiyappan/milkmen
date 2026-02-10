import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, MapPin, ChevronRight, Users } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { ShiftToggle, RouteFilter, SortableList } from '@/components/common'
import { useAppStore, useRouteStore } from '@/store'
import { useSortOrder } from '@/hooks/useSortOrder'
import { routesApi } from '@/services/api'
import type { ApiResponse } from '@/types'

interface RouteCustomerItem {
  id: string
  customerId: string
  areaId?: string | null
  customer: {
    id: string
    name: string
    phone?: string
    address?: string
    defaultRate: number
    isActive: boolean
    balance: number
  }
}

interface RouteDetailData {
  id: string
  routeCustomers: RouteCustomerItem[]
}

export function DeliveriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const [customers, setCustomers] = useState<RouteCustomerItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { applySortOrder, saveSortOrder } = useSortOrder('customer', currentShift)

  useEffect(() => {
    if (!selectedRouteId) {
      setCustomers([])
      return
    }

    const fetchRouteCustomers = async () => {
      setIsLoading(true)
      try {
        const response = await routesApi.get(selectedRouteId) as ApiResponse<RouteDetailData>
        if (response.success && response.data) {
          setCustomers(response.data.routeCustomers)
        }
      } catch (error) {
        console.error('Failed to fetch route customers:', error)
        setCustomers([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchRouteCustomers()
  }, [selectedRouteId])

  const filteredCustomers = selectedAreaId
    ? customers.filter((rc) => rc.areaId === selectedAreaId)
    : customers

  const customerMap = useMemo(() => {
    const map = new Map<string, RouteCustomerItem>()
    filteredCustomers.forEach((rc) => map.set(rc.customer.id, rc))
    return map
  }, [filteredCustomers])

  const sortedCustomerIds = useMemo(() => {
    const items = filteredCustomers.map((rc) => ({ id: rc.customer.id }))
    return applySortOrder(items).map((i) => i.id)
  }, [filteredCustomers, applySortOrder])

  const handleReorder = useCallback((newIds: string[]) => {
    saveSortOrder(newIds)
  }, [saveSortOrder])

  return (
    <AppShell title={t('delivery.title')}>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Shift Toggle */}
        <ShiftToggle
          value={currentShift}
          onChange={setCurrentShift}
          fullWidth
        />

        {/* Route Filter (includes Area Filter) */}
        <RouteFilter />

        {/* Customer List */}
        {!selectedRouteId ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('routes.allRoutes')}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t('delivery.selectRouteHint')}
            </p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {selectedAreaId ? t('areas.noCustomersAssigned') : t('routes.noCustomersAssigned')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredCustomers.length} {t('customer.customersFound')}
            </p>
            <SortableList
              items={sortedCustomerIds}
              onReorder={handleReorder}
              renderItem={(id) => {
                const rc = customerMap.get(id)
                if (!rc) return null
                return (
                  <Card
                    className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                    onClick={() => navigate(`/deliver/add?customerId=${rc.customer.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {rc.customer.name}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          {rc.customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {rc.customer.phone}
                            </span>
                          )}
                          {rc.customer.address && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {rc.customer.address}
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
