import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { useRouteStore } from '@/store'
import { areasApi } from '@/services/api'
import type { ApiResponse, AreaWithCounts } from '@/types'

export function AreaFilter() {
  const { t } = useTranslation()
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)
  const setSelectedArea = useRouteStore((state) => state.setSelectedArea)
  const [areas, setAreas] = useState<AreaWithCounts[]>([])

  useEffect(() => {
    if (!selectedRouteId) {
      setAreas([])
      return
    }
    const fetchAreas = async () => {
      try {
        const response = await areasApi.list(selectedRouteId) as ApiResponse<AreaWithCounts[]>
        if (response.success && response.data) {
          setAreas(response.data)
        }
      } catch {
        // Silently fail
      }
    }
    fetchAreas()
  }, [selectedRouteId])

  if (!selectedRouteId || areas.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <select
        value={selectedAreaId || ''}
        onChange={(e) => setSelectedArea(e.target.value || null)}
        className="flex-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="">{t('areas.allAreas')}</option>
        {areas.map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
          </option>
        ))}
      </select>
    </div>
  )
}
