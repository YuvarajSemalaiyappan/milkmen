import { useState, useEffect } from 'react'
import { routesApi } from '@/services/api'
import type { ApiResponse } from '@/types'

export function useRouteCustomerIds(routeId: string | null, areaId: string | null) {
  const [customerIds, setCustomerIds] = useState<Set<string> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!routeId) {
      setCustomerIds(null)
      return
    }

    const fetchIds = async () => {
      try {
        setIsLoading(true)
        const response = await routesApi.getCustomerIds(routeId, areaId || undefined) as ApiResponse<string[]>
        if (response.success && response.data) {
          setCustomerIds(new Set(response.data))
        }
      } catch (error) {
        console.error('Failed to fetch route customer IDs:', error)
        setCustomerIds(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchIds()
  }, [routeId, areaId])

  return { customerIds, isLoading }
}
