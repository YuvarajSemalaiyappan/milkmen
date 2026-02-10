import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/localDb'
import { useAuthStore } from '@/store'
import { farmersApi, customersApi } from '@/services/api'
import type { Shift } from '@/types'

type OrderType = 'customer' | 'farmer'

export function useSortOrder(type: OrderType, shift?: Shift) {
  const userId = useAuthStore((s) => s.user?.id)

  const orders = useLiveQuery(async () => {
    if (!userId) return []
    if (type === 'customer' && shift) {
      return db.customerOrders
        .where('[userId+shift]')
        .equals([userId, shift])
        .sortBy('sortOrder')
    }
    if (type === 'farmer') {
      return db.farmerOrders
        .where('[userId]')
        .equals([userId])
        .sortBy('sortOrder')
    }
    return []
  }, [userId, type, shift])

  const orderMap = useMemo(() => {
    if (!orders) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const o of orders) {
      const entityId = type === 'customer'
        ? (o as { customerId: string }).customerId
        : (o as { farmerId: string }).farmerId
      map.set(entityId, o.sortOrder)
    }
    return map
  }, [orders, type])

  const applySortOrder = useCallback(<T extends { id: string }>(items: T[]): T[] => {
    if (orderMap.size === 0) return items
    return [...items].sort((a, b) => {
      const orderA = orderMap.get(a.id)
      const orderB = orderMap.get(b.id)
      // Items without saved order go to the end
      if (orderA === undefined && orderB === undefined) return 0
      if (orderA === undefined) return 1
      if (orderB === undefined) return -1
      return orderA - orderB
    })
  }, [orderMap])

  const saveSortOrder = useCallback(async (orderedIds: string[]) => {
    if (!userId) return

    // Save locally first (offline-first)
    await db.transaction('rw', type === 'customer' ? db.customerOrders : db.farmerOrders, async () => {
      if (type === 'customer' && shift) {
        // Clear existing orders for this user+shift
        const existing = await db.customerOrders
          .where('[userId+shift]')
          .equals([userId, shift])
          .toArray()
        await db.customerOrders.bulkDelete(existing.map((e) => e.id))

        // Write new orders
        await db.customerOrders.bulkAdd(
          orderedIds.map((id, index) => ({
            id: `${userId}_${shift}_${id}`,
            localId: `${userId}_${shift}_${id}`,
            userId,
            customerId: id,
            shift,
            sortOrder: index
          }))
        )
      } else if (type === 'farmer') {
        const existing = await db.farmerOrders
          .where('[userId]')
          .equals([userId])
          .toArray()
        await db.farmerOrders.bulkDelete(existing.map((e) => e.id))

        await db.farmerOrders.bulkAdd(
          orderedIds.map((id, index) => ({
            id: `${userId}_farmer_${id}`,
            localId: `${userId}_farmer_${id}`,
            userId,
            farmerId: id,
            sortOrder: index
          }))
        )
      }
    })

    // Sync to server in background
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

  return { applySortOrder, saveSortOrder, isLoaded: orders !== undefined }
}
