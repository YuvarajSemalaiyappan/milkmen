import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/store'
import { farmersApi, customersApi } from '@/services/api'
import type { Shift } from '@/types'

type OrderType = 'customer' | 'farmer'

export function useSortOrder(type: OrderType, shift?: Shift) {
  const userId = useAuthStore((s) => s.user?.id)
  const [orderMap, setOrderMap] = useState<Map<string, number>>(new Map())
  const [isLoaded, setIsLoaded] = useState(false)

  // Sort order is returned as part of route data, not as a separate endpoint.
  // For now, we just maintain local state updated via save calls.
  useEffect(() => {
    setIsLoaded(true)
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
