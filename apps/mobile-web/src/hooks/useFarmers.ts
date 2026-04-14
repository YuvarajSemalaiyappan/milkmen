import { useState, useEffect, useCallback } from 'react'
import { farmersApi } from '@/services/api'
import { useAppStore } from '@/store'
import type { Farmer, ApiResponse } from '@/types'

export function useFarmers() {
  const addToast = useAppStore((state) => state.addToast)
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchFarmers = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await farmersApi.list() as ApiResponse<Farmer[]>
      if (response.success && response.data) {
        setFarmers(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch farmers:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFarmers()
  }, [fetchFarmers])

  const activeFarmers = farmers.filter((f) => f.isActive)

  const addFarmer = useCallback(
    async (data: {
      name: string
      phone?: string
      village?: string
      defaultRate: number
      collectAM?: boolean
      collectPM?: boolean
      subscriptionQtyAM?: number
      subscriptionQtyPM?: number
    }) => {
      try {
        const response = await farmersApi.create(data) as ApiResponse<Farmer>
        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Farmer added' })
          await fetchFarmers()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add farmer'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchFarmers]
  )

  const updateFarmer = useCallback(
    async (
      id: string,
      updates: Partial<{
        name: string
        phone?: string
        village?: string
        defaultRate: number
        collectAM: boolean
        collectPM: boolean
        subscriptionQtyAM?: number
        subscriptionQtyPM?: number
        isActive: boolean
      }>
    ) => {
      try {
        const response = await farmersApi.update(id, updates) as ApiResponse<Farmer>
        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Farmer updated' })
          await fetchFarmers()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update farmer'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchFarmers]
  )

  const deleteFarmer = useCallback(
    async (id: string) => {
      try {
        const response = await farmersApi.delete(id) as ApiResponse<void>
        if (response.success) {
          addToast({ type: 'success', message: 'Farmer deleted' })
          await fetchFarmers()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete farmer'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchFarmers]
  )

  const getFarmer = useCallback(async (id: string) => {
    try {
      const response = await farmersApi.get(id) as ApiResponse<Farmer>
      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch (error) {
      console.error('Failed to fetch farmer:', error)
      return null
    }
  }, [])

  const searchFarmers = useCallback(async (query: string, activeOnly = true) => {
    if (!query) {
      return activeOnly ? farmers.filter((f) => f.isActive) : farmers
    }
    const lowerQuery = query.toLowerCase()
    return farmers.filter(
      (f) =>
        (!activeOnly || f.isActive) &&
        (f.name.toLowerCase().includes(lowerQuery) ||
          f.phone?.toLowerCase().includes(lowerQuery) ||
          f.village?.toLowerCase().includes(lowerQuery))
    )
  }, [farmers])

  return {
    farmers,
    activeFarmers,
    addFarmer,
    updateFarmer,
    deleteFarmer,
    getFarmer,
    searchFarmers,
    fetchFarmers,
    isLoading
  }
}

export default useFarmers
