import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateLocalId, now } from '@/db/localDb'
import { syncService } from '@/services/syncService'
import { useAppStore } from '@/store'
import type { LocalCustomer } from '@/types'

export function useCustomers() {
  const addToast = useAppStore((state) => state.addToast)

  // Live query from IndexedDB
  const customers = useLiveQuery(
    () => db.customers.orderBy('updatedAt').reverse().toArray(),
    []
  )

  const activeCustomers = useLiveQuery(
    () => db.customers.filter((c) => c.data.isActive).toArray(),
    []
  )

  // Add new customer
  const addCustomer = useCallback(
    async (data: {
      name: string
      phone?: string
      address?: string
      defaultRate: number
      subscriptionQtyAM?: number
      subscriptionQtyPM?: number
    }) => {
      const localId = generateLocalId()
      const timestamp = now()

      const customer: LocalCustomer = {
        id: localId,
        localId,
        syncStatus: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
        data: {
          name: data.name,
          phone: data.phone,
          address: data.address,
          defaultRate: data.defaultRate,
          subscriptionQtyAM: data.subscriptionQtyAM,
          subscriptionQtyPM: data.subscriptionQtyPM,
          isActive: true,
          balance: 0
        }
      }

      await db.customers.add(customer)

      // Queue for sync
      await syncService.queueSync('customers', localId, 'create', {
        ...data,
        localId
      })

      addToast({ type: 'success', message: 'Customer added' })
      return customer
    },
    [addToast]
  )

  // Update customer
  const updateCustomer = useCallback(
    async (
      id: string,
      updates: Partial<{
        name: string
        phone?: string
        address?: string
        defaultRate: number
        subscriptionQtyAM?: number
        subscriptionQtyPM?: number
        isActive: boolean
      }>
    ) => {
      const customer = await db.customers.get(id)
      if (!customer) throw new Error('Customer not found')

      const timestamp = now()
      const updatedCustomer: LocalCustomer = {
        ...customer,
        syncStatus: 'PENDING',
        updatedAt: timestamp,
        data: { ...customer.data, ...updates }
      }

      await db.customers.put(updatedCustomer)

      // Queue for sync - include phone so server can resolve local_ IDs
      await syncService.queueSync('customers', customer.localId, 'update', {
        id: customer.id,
        phone: customer.data.phone,
        ...updates
      })

      addToast({ type: 'success', message: 'Customer updated' })
      return updatedCustomer
    },
    [addToast]
  )

  // Delete customer (soft delete)
  const deleteCustomer = useCallback(
    async (id: string) => {
      const customer = await db.customers.get(id)
      if (!customer) throw new Error('Customer not found')

      await updateCustomer(id, { isActive: false })
      addToast({ type: 'success', message: 'Customer deleted' })
    },
    [updateCustomer, addToast]
  )

  // Get customer by ID
  const getCustomer = useCallback(async (id: string) => {
    return db.customers.get(id)
  }, [])

  // Search customers
  const searchCustomers = useCallback(async (query: string, activeOnly = true) => {
    if (!query) {
      if (activeOnly) return db.customers.filter((c) => !!c.data.isActive).toArray()
      return db.customers.orderBy('updatedAt').reverse().toArray()
    }

    const lowerQuery = query.toLowerCase()
    return db.customers
      .filter(
        (c) =>
          (!activeOnly || !!c.data.isActive) &&
          (c.data.name.toLowerCase().includes(lowerQuery) ||
            !!c.data.phone?.toLowerCase().includes(lowerQuery) ||
            !!c.data.address?.toLowerCase().includes(lowerQuery))
      )
      .toArray()
  }, [])

  // Get customers with subscriptions
  const getSubscribedCustomers = useCallback(
    async (shift?: 'MORNING' | 'EVENING') => {
      return db.customers
        .filter((c) => {
          if (!c.data.isActive) return false
          if (shift === 'MORNING') return !!c.data.subscriptionQtyAM
          if (shift === 'EVENING') return !!c.data.subscriptionQtyPM
          return !!c.data.subscriptionQtyAM || !!c.data.subscriptionQtyPM
        })
        .toArray()
    },
    []
  )

  const stableCustomers = useMemo(() => customers ?? [], [customers])
  const stableActiveCustomers = useMemo(() => activeCustomers ?? [], [activeCustomers])

  return {
    customers: stableCustomers,
    activeCustomers: stableActiveCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomer,
    searchCustomers,
    getSubscribedCustomers,
    isLoading: customers === undefined
  }
}

export default useCustomers
