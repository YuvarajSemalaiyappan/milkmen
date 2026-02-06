import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateLocalId, now } from '@/db/localDb'
import { syncService } from '@/services/syncService'
import { useAppStore } from '@/store'
import { calculateTotal } from '@/utils/calculate'
import { getToday } from '@/utils/format'
import type { LocalDelivery, Shift, DeliveryStatus } from '@/types'

export function useDeliveries() {
  const addToast = useAppStore((state) => state.addToast)
  const currentShift = useAppStore((state) => state.currentShift)

  // Today's deliveries
  const todayDeliveries = useLiveQuery(async () => {
    const today = getToday()
    const deliveries = await db.deliveries
      .filter((d) => d.data.date === today)
      .toArray()
    console.log('[useDeliveries] Today:', today, 'Found deliveries:', deliveries.length, deliveries.map(d => d.id))
    return deliveries
  }, [])

  // All deliveries
  const deliveries = useLiveQuery(
    async () => {
      const all = await db.deliveries.orderBy('updatedAt').reverse().toArray()
      console.log('[useDeliveries] All deliveries in DB:', all.length)
      return all
    },
    []
  )

  // Add new delivery
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
      const localId = generateLocalId()
      const timestamp = now()
      const totalAmount = calculateTotal(data.quantity, data.ratePerLiter)

      const delivery: LocalDelivery = {
        id: localId,
        localId,
        syncStatus: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
        data: {
          customerId: data.customerId,
          date: data.date || getToday(),
          shift: data.shift || currentShift,
          quantity: data.quantity,
          ratePerLiter: data.ratePerLiter,
          totalAmount,
          status: data.status || 'DELIVERED',
          isSubscription: data.isSubscription || false,
          notes: data.notes
        }
      }

      await db.deliveries.add(delivery)
      console.log('[useDeliveries] Delivery saved to IndexedDB:', delivery.id, delivery.data)

      // Verify it was saved
      const savedDelivery = await db.deliveries.get(delivery.id)
      console.log('[useDeliveries] Verified saved delivery:', savedDelivery ? 'Found' : 'NOT FOUND')

      // Update customer balance (they owe us)
      const customer = await db.customers.get(data.customerId)
      if (customer) {
        await db.customers.update(data.customerId, {
          'data.balance': customer.data.balance + totalAmount,
          updatedAt: timestamp
        })
      }

      // Queue for sync
      await syncService.queueSync('deliveries', localId, 'create', {
        ...delivery.data,
        localId
      })

      addToast({ type: 'success', message: 'Delivery saved' })
      return delivery
    },
    [addToast, currentShift]
  )

  // Update delivery
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
      const delivery = await db.deliveries.get(id)
      if (!delivery) throw new Error('Delivery not found')

      const timestamp = now()
      const oldTotal = delivery.data.totalAmount

      // Calculate new total if quantity or rate changed
      const newQuantity = updates.quantity ?? delivery.data.quantity
      const newRate = updates.ratePerLiter ?? delivery.data.ratePerLiter
      const newTotal = calculateTotal(newQuantity, newRate)

      const updatedDelivery: LocalDelivery = {
        ...delivery,
        syncStatus: 'PENDING',
        updatedAt: timestamp,
        data: {
          ...delivery.data,
          ...updates,
          totalAmount: newTotal,
          rateEditedAt: updates.ratePerLiter ? new Date().toISOString() : delivery.data.rateEditedAt,
          originalRate: delivery.data.originalRate || delivery.data.ratePerLiter
        }
      }

      await db.deliveries.put(updatedDelivery)

      // Update customer balance (adjust for difference)
      const customer = await db.customers.get(delivery.data.customerId)
      if (customer) {
        const balanceDiff = newTotal - oldTotal
        await db.customers.update(delivery.data.customerId, {
          'data.balance': customer.data.balance + balanceDiff,
          updatedAt: timestamp
        })
      }

      // Queue for sync
      await syncService.queueSync('deliveries', delivery.localId, 'update', {
        id: delivery.id,
        ...updates,
        totalAmount: newTotal
      })

      addToast({ type: 'success', message: 'Delivery updated' })
      return updatedDelivery
    },
    [addToast]
  )

  // Delete delivery
  const deleteDelivery = useCallback(
    async (id: string) => {
      const delivery = await db.deliveries.get(id)
      if (!delivery) throw new Error('Delivery not found')

      // Update customer balance (subtract the amount)
      const customer = await db.customers.get(delivery.data.customerId)
      if (customer) {
        await db.customers.update(delivery.data.customerId, {
          'data.balance': customer.data.balance - delivery.data.totalAmount,
          updatedAt: now()
        })
      }

      // Delete from local DB
      await db.deliveries.delete(id)

      // Queue for sync
      await syncService.queueSync('deliveries', delivery.localId, 'delete', {
        id: delivery.id
      })

      addToast({ type: 'success', message: 'Delivery deleted' })
    },
    [addToast]
  )

  // Get deliveries by date
  const getDeliveriesByDate = useCallback(async (date: string) => {
    return db.deliveries.filter((d) => d.data.date === date).toArray()
  }, [])

  // Get deliveries by customer
  const getDeliveriesByCustomer = useCallback(
    async (customerId: string, from?: string, to?: string) => {
      return db.deliveries
        .filter((d) => {
          if (d.data.customerId !== customerId) return false
          if (from && d.data.date < from) return false
          if (to && d.data.date > to) return false
          return true
        })
        .toArray()
    },
    []
  )

  // Get deliveries by date range
  const getDeliveriesByDateRange = useCallback(
    async (from: string, to: string) => {
      return db.deliveries
        .filter((d) => d.data.date >= from && d.data.date <= to)
        .toArray()
    },
    []
  )

  // Calculate today's totals
  const todayTotals = useLiveQuery(async () => {
    const today = getToday()
    const deliveries = await db.deliveries
      .filter((d) => d.data.date === today)
      .toArray()

    return {
      liters: deliveries.reduce((sum, d) => sum + Number(d.data.quantity), 0),
      amount: deliveries.reduce((sum, d) => sum + Number(d.data.totalAmount), 0),
      count: deliveries.length
    }
  }, [])

  return {
    deliveries: deliveries || [],
    todayDeliveries: todayDeliveries || [],
    todayTotals: todayTotals || { liters: 0, amount: 0, count: 0 },
    addDelivery,
    updateDelivery,
    deleteDelivery,
    getDeliveriesByDate,
    getDeliveriesByCustomer,
    getDeliveriesByDateRange,
    isLoading: deliveries === undefined
  }
}

export default useDeliveries
