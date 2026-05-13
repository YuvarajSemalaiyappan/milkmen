import { useState, useEffect, useCallback } from 'react'
import { deliveriesApi } from '@/services/api'
import { useAppStore } from '@/store'
import { getToday } from '@/utils/format'
import type { Delivery, Shift, DeliveryStatus, ApiResponse } from '@/types'

export function useDeliveries(options?: { skipInitialFetch?: boolean }) {
  const skipInitialFetch = options?.skipInitialFetch ?? false
  const addToast = useAppStore((state) => state.addToast)
  const currentShift = useAppStore((state) => state.currentShift)
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([])
  const [isLoading, setIsLoading] = useState(!skipInitialFetch)
  const [error, setError] = useState(false)

  const fetchDeliveries = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(false)
      const response = await deliveriesApi.list({ date: getToday() }) as ApiResponse<Delivery[]>
      if (response.success && response.data) {
        setTodayDeliveries(response.data)
      }
    } catch (err) {
      console.error('Failed to fetch deliveries:', err)
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (skipInitialFetch) return
    fetchDeliveries()
  }, [fetchDeliveries, skipInitialFetch])

  const todayTotals = {
    liters: todayDeliveries.reduce((sum, d) => sum + Number(d.quantity), 0),
    amount: todayDeliveries.reduce((sum, d) => sum + Number(d.totalAmount), 0),
    count: todayDeliveries.length
  }

  const addDelivery = useCallback(
    async (data: {
      customerId: string
      date?: string
      shift?: Shift
      quantity: number
      ratePerLiter: number
      status?: DeliveryStatus
      isSubscription?: boolean
      notes?: string
    }) => {
      try {
        const response = await deliveriesApi.create({
          customerId: data.customerId,
          date: data.date || getToday(),
          shift: data.shift || currentShift,
          quantity: data.quantity,
          ratePerLiter: data.ratePerLiter,
          status: data.status || 'DELIVERED',
          isSubscription: data.isSubscription || false,
          notes: data.notes
        }) as ApiResponse<Delivery>

        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Delivery saved' })
          await fetchDeliveries()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save delivery'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, currentShift, fetchDeliveries]
  )

  const updateDelivery = useCallback(
    async (
      id: string,
      updates: Partial<{
        quantity: number
        ratePerLiter: number
        status: DeliveryStatus
        notes?: string
      }>
    ) => {
      try {
        const response = await deliveriesApi.update(id, updates) as ApiResponse<Delivery>
        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Delivery updated' })
          await fetchDeliveries()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update delivery'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchDeliveries]
  )

  const deleteDelivery = useCallback(
    async (id: string) => {
      try {
        const response = await deliveriesApi.delete(id) as ApiResponse<void>
        if (response.success) {
          addToast({ type: 'success', message: 'Delivery deleted' })
          await fetchDeliveries()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete delivery'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchDeliveries]
  )

  const getDeliveriesByDate = useCallback(async (date: string) => {
    try {
      const response = await deliveriesApi.list({ date }) as ApiResponse<Delivery[]>
      if (response.success && response.data) {
        return response.data
      }
      return []
    } catch (error) {
      console.error('Failed to fetch deliveries by date:', error)
      return []
    }
  }, [])

  const getDeliveriesByCustomer = useCallback(
    async (customerId: string, from?: string, to?: string, limit?: number) => {
      try {
        const response = await deliveriesApi.list({ customerId, from, to }) as ApiResponse<Delivery[]>
        if (response.success && response.data) {
          let result = response.data
          result.sort((a, b) => b.date.localeCompare(a.date))
          if (limit) result = result.slice(0, limit)
          return result
        }
        return []
      } catch (error) {
        console.error('Failed to fetch deliveries by customer:', error)
        return []
      }
    },
    []
  )

  const getDeliveriesByDateRange = useCallback(
    async (from: string, to: string) => {
      try {
        const response = await deliveriesApi.list({ from, to }) as ApiResponse<Delivery[]>
        if (response.success && response.data) {
          return response.data
        }
        return []
      } catch (error) {
        console.error('Failed to fetch deliveries by date range:', error)
        return []
      }
    },
    []
  )

  return {
    deliveries: todayDeliveries,
    todayDeliveries,
    todayTotals,
    addDelivery,
    updateDelivery,
    deleteDelivery,
    getDeliveriesByDate,
    getDeliveriesByCustomer,
    getDeliveriesByDateRange,
    fetchDeliveries,
    isLoading,
    error
  }
}

export default useDeliveries
