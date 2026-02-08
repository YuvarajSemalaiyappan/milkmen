import { useState, useEffect } from 'react'
import { routesApi } from '@/services/api'
import type { ApiResponse } from '@/types'

export function useRouteFarmerIds(routeId: string | null, areaId: string | null) {
  const [farmerIds, setFarmerIds] = useState<Set<string> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!routeId) {
      setFarmerIds(null)
      return
    }

    const fetchIds = async () => {
      try {
        setIsLoading(true)
        const response = await routesApi.getFarmerIds(routeId, areaId || undefined) as ApiResponse<string[]>
        if (response.success && response.data) {
          setFarmerIds(new Set(response.data))
        }
      } catch (error) {
        console.error('Failed to fetch route farmer IDs:', error)
        setFarmerIds(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchIds()
  }, [routeId, areaId])

  return { farmerIds, isLoading }
}
