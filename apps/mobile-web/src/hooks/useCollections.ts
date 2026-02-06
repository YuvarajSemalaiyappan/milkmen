import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateLocalId, now } from '@/db/localDb'
import { syncService } from '@/services/syncService'
import { useAppStore } from '@/store'
import { calculateTotal } from '@/utils/calculate'
import { getToday } from '@/utils/format'
import type { LocalCollection, Shift } from '@/types'

export function useCollections() {
  const addToast = useAppStore((state) => state.addToast)
  const currentShift = useAppStore((state) => state.currentShift)

  // Today's collections
  const todayCollections = useLiveQuery(async () => {
    const today = getToday()
    return db.collections
      .filter((c) => c.data.date === today)
      .toArray()
  }, [])

  // All collections
  const collections = useLiveQuery(
    () => db.collections.orderBy('updatedAt').reverse().toArray(),
    []
  )

  // Add new collection
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
      const localId = generateLocalId()
      const timestamp = now()
      const totalAmount = calculateTotal(data.quantity, data.ratePerLiter)

      const collection: LocalCollection = {
        id: localId,
        localId,
        syncStatus: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
        data: {
          farmerId: data.farmerId,
          date: data.date || getToday(),
          shift: data.shift || currentShift,
          quantity: data.quantity,
          fatContent: data.fatContent,
          ratePerLiter: data.ratePerLiter,
          totalAmount,
          notes: data.notes
        }
      }

      await db.collections.add(collection)

      // Update farmer balance
      const farmer = await db.farmers.get(data.farmerId)
      if (farmer) {
        await db.farmers.update(data.farmerId, {
          'data.balance': farmer.data.balance + totalAmount,
          updatedAt: timestamp
        })
      }

      // Queue for sync
      await syncService.queueSync('collections', localId, 'create', {
        ...collection.data,
        localId
      })

      addToast({ type: 'success', message: 'Collection saved' })
      return collection
    },
    [addToast, currentShift]
  )

  // Update collection
  const updateCollection = useCallback(
    async (
      id: string,
      updates: Partial<{
        quantity: number
        fatContent?: number
        ratePerLiter: number
        notes?: string
      }>
    ) => {
      const collection = await db.collections.get(id)
      if (!collection) throw new Error('Collection not found')

      const timestamp = now()
      const oldTotal = collection.data.totalAmount

      // Calculate new total if quantity or rate changed
      const newQuantity = updates.quantity ?? collection.data.quantity
      const newRate = updates.ratePerLiter ?? collection.data.ratePerLiter
      const newTotal = calculateTotal(newQuantity, newRate)

      const updatedCollection: LocalCollection = {
        ...collection,
        syncStatus: 'PENDING',
        updatedAt: timestamp,
        data: {
          ...collection.data,
          ...updates,
          totalAmount: newTotal,
          rateEditedAt: updates.ratePerLiter ? new Date().toISOString() : collection.data.rateEditedAt,
          originalRate: collection.data.originalRate || collection.data.ratePerLiter
        }
      }

      await db.collections.put(updatedCollection)

      // Update farmer balance (adjust for difference)
      const farmer = await db.farmers.get(collection.data.farmerId)
      if (farmer) {
        const balanceDiff = newTotal - oldTotal
        await db.farmers.update(collection.data.farmerId, {
          'data.balance': farmer.data.balance + balanceDiff,
          updatedAt: timestamp
        })
      }

      // Queue for sync
      await syncService.queueSync('collections', collection.localId, 'update', {
        id: collection.id,
        ...updates,
        totalAmount: newTotal
      })

      addToast({ type: 'success', message: 'Collection updated' })
      return updatedCollection
    },
    [addToast]
  )

  // Delete collection
  const deleteCollection = useCallback(
    async (id: string) => {
      const collection = await db.collections.get(id)
      if (!collection) throw new Error('Collection not found')

      // Update farmer balance (subtract the amount)
      const farmer = await db.farmers.get(collection.data.farmerId)
      if (farmer) {
        await db.farmers.update(collection.data.farmerId, {
          'data.balance': farmer.data.balance - collection.data.totalAmount,
          updatedAt: now()
        })
      }

      // Delete from local DB
      await db.collections.delete(id)

      // Queue for sync
      await syncService.queueSync('collections', collection.localId, 'delete', {
        id: collection.id
      })

      addToast({ type: 'success', message: 'Collection deleted' })
    },
    [addToast]
  )

  // Get collections by date
  const getCollectionsByDate = useCallback(async (date: string) => {
    return db.collections.filter((c) => c.data.date === date).toArray()
  }, [])

  // Get collections by farmer
  const getCollectionsByFarmer = useCallback(
    async (farmerId: string, from?: string, to?: string) => {
      return db.collections
        .filter((c) => {
          if (c.data.farmerId !== farmerId) return false
          if (from && c.data.date < from) return false
          if (to && c.data.date > to) return false
          return true
        })
        .toArray()
    },
    []
  )

  // Get collections by date range
  const getCollectionsByDateRange = useCallback(
    async (from: string, to: string) => {
      return db.collections
        .filter((c) => c.data.date >= from && c.data.date <= to)
        .toArray()
    },
    []
  )

  // Calculate today's totals
  const todayTotals = useLiveQuery(async () => {
    const today = getToday()
    const collections = await db.collections
      .filter((c) => c.data.date === today)
      .toArray()

    return {
      liters: collections.reduce((sum, c) => sum + Number(c.data.quantity), 0),
      amount: collections.reduce((sum, c) => sum + Number(c.data.totalAmount), 0),
      count: collections.length
    }
  }, [])

  return {
    collections: collections || [],
    todayCollections: todayCollections || [],
    todayTotals: todayTotals || { liters: 0, amount: 0, count: 0 },
    addCollection,
    updateCollection,
    deleteCollection,
    getCollectionsByDate,
    getCollectionsByFarmer,
    getCollectionsByDateRange,
    isLoading: collections === undefined
  }
}

export default useCollections
