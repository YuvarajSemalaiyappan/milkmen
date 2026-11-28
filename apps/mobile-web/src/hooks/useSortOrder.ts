import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store'
import { farmersApi, customersApi, orderShareApi } from '@/services/api'
import type { Shift, ApiResponse, OrderFollow } from '@/types'

type OrderType = 'customer' | 'farmer'

type FarmerOrderRow = { farmerId: string; sortOrder: number; shift: Shift | null }
type CustomerOrderRow = { customerId: string; sortOrder: number; shift: Shift | null }

// Farmers and customers each keep a separate order per shift (pass the shift).
// Following someone's order (both shifts): the server returns their order, live, and saving is off
// (`following` is set). `reload` fetches again after following, stopping or copying.
export function useSortOrder(type: OrderType, shift?: Shift) {
  const userId = useAuthStore((s) => s.user?.id)
  const [orderMap, setOrderMap] = useState<Map<string, number>>(new Map())
  const [isLoaded, setIsLoaded] = useState(false)
  const [following, setFollowing] = useState<OrderFollow['following']>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

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
        const follow = orderShareApi.get(type).then((r) => (r as ApiResponse<OrderFollow>).data?.following ?? null).catch(() => null)
        if (type === 'farmer') {
          const res = (await farmersApi.getSortOrder(shift)) as ApiResponse<FarmerOrderRow[]>
          res.data?.forEach((row) => newMap.set(row.farmerId, row.sortOrder))
        } else {
          const res = (await customersApi.getSortOrder(shift)) as ApiResponse<CustomerOrderRow[]>
          res.data?.forEach((row) => newMap.set(row.customerId, row.sortOrder))
        }
        const who = await follow
        if (!cancelled) {
          setOrderMap(newMap)
          setFollowing(who)
        }
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
  }, [userId, type, shift, version])

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
    if (!userId || following) return

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
          orderedIds.map((id, index) => ({ farmerId: id, shift, sortOrder: index }))
        )
      }
    } catch (error) {
      console.error('Failed to sync sort order to server:', error)
    }
  }, [userId, type, shift, following])

  return { applySortOrder, saveSortOrder, isLoaded, following, reload }
}
