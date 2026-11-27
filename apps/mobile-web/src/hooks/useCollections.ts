import { useState, useEffect, useCallback } from 'react'
import { collectionsApi, ApiError } from '@/services/api'
import { useAppStore } from '@/store'
import { getToday } from '@/utils/format'
import type { Collection, Shift, ApiResponse } from '@/types'

export function useCollections(options?: { skipInitialFetch?: boolean }) {
  const skipInitialFetch = options?.skipInitialFetch ?? false
  const addToast = useAppStore((state) => state.addToast)
  const currentShift = useAppStore((state) => state.currentShift)
  const [todayCollections, setTodayCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(!skipInitialFetch)
  const [error, setError] = useState(false)

  const fetchCollections = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(false)
      const response = await collectionsApi.list({ date: getToday() }) as ApiResponse<Collection[]>
      if (response.success && response.data) {
        setTodayCollections(response.data)
      }
    } catch (err) {
      console.error('Failed to fetch collections:', err)
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (skipInitialFetch) return
    fetchCollections()
  }, [fetchCollections, skipInitialFetch])

  const todayTotals = {
    liters: todayCollections.reduce((sum, c) => sum + Number(c.quantity), 0),
    amount: todayCollections.reduce((sum, c) => sum + Number(c.totalAmount), 0),
    count: todayCollections.length
  }

  const addCollection = useCallback(
    async (data: {
      farmerId: string
      date?: string
      shift?: Shift
      quantity: number
      fatContent?: number
      ratePerLiter: number
      notes?: string
    }) => {
      try {
        const payload = {
          farmerId: data.farmerId,
          date: data.date || getToday(),
          shift: data.shift || currentShift,
          quantity: data.quantity,
          fatContent: data.fatContent,
          ratePerLiter: data.ratePerLiter,
          notes: data.notes
        }
        let response: ApiResponse<Collection>
        try {
          response = await collectionsApi.create(payload) as ApiResponse<Collection>
        } catch (error) {
          // The server refuses a second entry for the same farmer and shift unless the user confirms it
          if (!(error instanceof ApiError && error.code === 'DUPLICATE_ENTRY')) throw error
          if (!window.confirm('Milk is already entered for this farmer in this shift. Add another entry?')) return
          response = await collectionsApi.create({ ...payload, allowDuplicate: true }) as ApiResponse<Collection>
        }

        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Collection saved' })
          await fetchCollections()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save collection'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, currentShift, fetchCollections]
  )

  const updateCollection = useCallback(
    async (
      id: string,
      updates: Partial<{
        quantity: number
        fatContent?: number
        ratePerLiter: number
        notes?: string
        date?: string
        shift?: Shift
      }>
    ) => {
      try {
        let response: ApiResponse<Collection>
        try {
          response = await collectionsApi.update(id, updates) as ApiResponse<Collection>
        } catch (error) {
          // Moving it onto a day/shift that already has an entry: ask, like a new entry
          if (!(error instanceof ApiError && error.code === 'DUPLICATE_ENTRY')) throw error
          if (!window.confirm('Milk is already entered for this farmer in this shift. Add another entry?')) return
          response = await collectionsApi.update(id, { ...updates, allowDuplicate: true }) as ApiResponse<Collection>
        }
        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Collection updated' })
          await fetchCollections()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update collection'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchCollections]
  )

  const deleteCollection = useCallback(
    async (id: string) => {
      try {
        const response = await collectionsApi.delete(id) as ApiResponse<void>
        if (response.success) {
          addToast({ type: 'success', message: 'Collection deleted' })
          await fetchCollections()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete collection'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchCollections]
  )

  const getCollectionsByDate = useCallback(async (date: string) => {
    try {
      const response = await collectionsApi.list({ date }) as ApiResponse<Collection[]>
      if (response.success && response.data) {
        return response.data
      }
      return []
    } catch (error) {
      console.error('Failed to fetch collections by date:', error)
      return []
    }
  }, [])

  const getCollectionsByFarmer = useCallback(
    async (farmerId: string, from?: string, to?: string, limit?: number) => {
      try {
        const response = await collectionsApi.list({ farmerId, from, to, paid: '1' }) as ApiResponse<Collection[]>
        if (response.success && response.data) {
          let result = response.data
          result.sort((a, b) => b.date.localeCompare(a.date))
          if (limit) result = result.slice(0, limit)
          return result
        }
        return []
      } catch (error) {
        console.error('Failed to fetch collections by farmer:', error)
        return []
      }
    },
    []
  )

  const getCollectionsByDateRange = useCallback(
    async (from: string, to: string) => {
      try {
        const response = await collectionsApi.list({ from, to }) as ApiResponse<Collection[]>
        if (response.success && response.data) {
          return response.data
        }
        return []
      } catch (error) {
        console.error('Failed to fetch collections by date range:', error)
        return []
      }
    },
    []
  )

  return {
    collections: todayCollections,
    todayCollections,
    todayTotals,
    addCollection,
    updateCollection,
    deleteCollection,
    getCollectionsByDate,
    getCollectionsByFarmer,
    getCollectionsByDateRange,
    fetchCollections,
    isLoading,
    error
  }
}

export default useCollections
