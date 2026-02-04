import { useCallback } from 'react'
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
      subscriptionQty?: number
      subscriptionAM?: boolean
      subscriptionPM?: boolean
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
          subscriptionQty: data.subscriptionQty,
          subscriptionAM: data.subscriptionAM ?? true,
          subscriptionPM: data.subscriptionPM ?? false,
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
        subscriptionQty?: number
        subscriptionAM?: boolean
        subscriptionPM?: boolean
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
  const searchCustomers = useCallback(async (query: string) => {
    if (!query) return db.customers.filter((c) => !!c.data.isActive).toArray()

    const lowerQuery = query.toLowerCase()
    return db.customers
      .filter(
        (c) =>
          !!c.data.isActive &&
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
          if (!c.data.isActive || !c.data.subscriptionQty) return false
          if (shift === 'MORNING') return c.data.subscriptionAM
          if (shift === 'EVENING') return c.data.subscriptionPM
          return c.data.subscriptionAM || c.data.subscriptionPM
        })
        .toArray()
    },
    []
  )

  return {
    customers: customers || [],
    activeCustomers: activeCustomers || [],
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
