import { useState, useEffect, useCallback } from 'react'
import { areasApi } from '@/services/api'
import { useAppStore } from '@/store'
import type { ApiResponse, AreaWithCounts } from '@/types'

export function useAreas(routeId?: string | null) {
  const addToast = useAppStore((state) => state.addToast)
  const [areas, setAreas] = useState<AreaWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchAreas = useCallback(async () => {
    if (!routeId) {
      setAreas([])
      return
    }
    try {
      setIsLoading(true)
      const response = await areasApi.list(routeId) as ApiResponse<AreaWithCounts[]>
      if (response.success && response.data) {
        setAreas(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch areas:', error)
    } finally {
      setIsLoading(false)
    }
  }, [routeId])

  useEffect(() => {
    fetchAreas()
  }, [fetchAreas])

  const createArea = useCallback(async (data: { routeId: string; name: string }) => {
    try {
      const response = await areasApi.create(data) as ApiResponse<AreaWithCounts>
      if (response.success) {
        addToast({ type: 'success', message: 'Area created' })
        await fetchAreas()
        return response.data
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create area'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchAreas])

  const updateArea = useCallback(async (id: string, data: Partial<{ name: string; isActive: boolean }>) => {
    try {
      const response = await areasApi.update(id, data) as ApiResponse<AreaWithCounts>
      if (response.success) {
        addToast({ type: 'success', message: 'Area updated' })
        await fetchAreas()
        return response.data
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update area'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchAreas])

  const deleteArea = useCallback(async (id: string) => {
    try {
      const response = await areasApi.delete(id) as ApiResponse<void>
      if (response.success) {
        addToast({ type: 'success', message: 'Area deleted' })
        await fetchAreas()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete area'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchAreas])

  return {
    areas,
    isLoading,
    createArea,
    updateArea,
    deleteArea,
    fetchAreas
  }
}

export default useAreas
