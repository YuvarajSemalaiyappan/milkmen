import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store'
import { farmersApi, customersApi } from '@/services/api'
import type { Shift, ApiResponse } from '@/types'

type OrderType = 'customer' | 'farmer'

type FarmerOrderRow = { farmerId: string; sortOrder: number }
type CustomerOrderRow = { customerId: string; sortOrder: number; shift: Shift | null }

export function useSortOrder(type: OrderType, shift?: Shift) {
  const userId = useAuthStore((s) => s.user?.id)
  const [orderMap, setOrderMap] = useState<Map<string, number>>(new Map())
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!userId) {
      setOrderMap(new Map())
      setIsLoaded(true)
      return
    }
    let cancelled = false
    setIsLoaded(false)
    ;(async () => {
      try {
        const newMap = new Map<string, number>()
        if (type === 'farmer') {
          const res = (await farmersApi.getSortOrder()) as ApiResponse<FarmerOrderRow[]>
          res.data?.forEach((row) => newMap.set(row.farmerId, row.sortOrder))
        } else {
          const res = (await customersApi.getSortOrder(shift)) as ApiResponse<CustomerOrderRow[]>
          res.data?.forEach((row) => newMap.set(row.customerId, row.sortOrder))
        }
        if (!cancelled) setOrderMap(newMap)
      } catch (error) {
        console.error('Failed to load sort order:', error)
        if (!cancelled) setOrderMap(new Map())
      } finally {
        if (!cancelled) setIsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, type, shift])

  const applySortOrder = useCallback(<T extends { id: string }>(items: T[]): T[] => {
    if (orderMap.size === 0) return items
    return [...items].sort((a, b) => {
      const orderA = orderMap.get(a.id)
      const orderB = orderMap.get(b.id)
      if (orderA === undefined && orderB === undefined) return 0
      if (orderA === undefined) return 1
      if (orderB === undefined) return -1
      return orderA - orderB
    })
  }, [orderMap])

  const saveSortOrder = useCallback(async (orderedIds: string[]) => {
    if (!userId) return

    // Update local state immediately
    const newMap = new Map<string, number>()
    orderedIds.forEach((id, index) => newMap.set(id, index))
    setOrderMap(newMap)

    // Save to server
    try {
      if (type === 'customer') {
        await customersApi.updateSortOrder(
          orderedIds.map((id, index) => ({ customerId: id, shift, sortOrder: index }))
        )
      } else {
        await farmersApi.updateSortOrder(
          orderedIds.map((id, index) => ({ farmerId: id, sortOrder: index }))
        )
      }
    } catch (error) {
      console.error('Failed to sync sort order to server:', error)
    }
  }, [userId, type, shift])

  return { applySortOrder, saveSortOrder, isLoaded }
}
