import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { useRouteStore } from '@/store'
import { routesApi } from '@/services/api'
import type { ApiResponse, RouteWithCounts } from '@/types'

export function RouteFilter() {
  const { t } = useTranslation()
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const setSelectedRoute = useRouteStore((state) => state.setSelectedRoute)
  const [routes, setRoutes] = useState<RouteWithCounts[]>([])

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await routesApi.list({ active: 'true' }) as ApiResponse<RouteWithCounts[]>
        if (response.success && response.data) {
          setRoutes(response.data)
        }
      } catch {
        // Silently fail - routes may not be set up yet
      }
    }
    fetchRoutes()
  }, [])

  if (routes.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <select
        value={selectedRouteId || ''}
        onChange={(e) => setSelectedRoute(e.target.value || null)}
        className="flex-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="">{t('routes.allRoutes')}</option>
        {routes.map((route) => (
          <option key={route.id} value={route.id}>
            {route.name}
          </option>
        ))}
      </select>
    </div>
  )
}
