import { useState, useEffect, useCallback, useMemo } from 'react'
import { customersApi } from '@/services/api'
import { useAppStore } from '@/store'
import type { Customer, ApiResponse } from '@/types'

export function useCustomers() {
  const addToast = useAppStore((state) => state.addToast)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(false)
      const response = await customersApi.list() as ApiResponse<Customer[]>
      if (response.success && response.data) {
        setCustomers(response.data)
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err)
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const activeCustomers = useMemo(() => customers.filter((c) => c.isActive), [customers])

  const addCustomer = useCallback(
    async (data: {
      name: string
      phone?: string
      address?: string
      defaultRate: number
      subscriptionQtyAM?: number
      subscriptionQtyPM?: number
    }) => {
      try {
        const response = await customersApi.create(data) as ApiResponse<Customer>
        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Customer added' })
          await fetchCustomers()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add customer'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchCustomers]
  )

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
      try {
        const response = await customersApi.update(id, updates) as ApiResponse<Customer>
        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Customer updated' })
          await fetchCustomers()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update customer'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchCustomers]
  )

  const deleteCustomer = useCallback(
    async (id: string) => {
      try {
        const response = await customersApi.delete(id) as ApiResponse<void>
        if (response.success) {
          addToast({ type: 'success', message: 'Customer deleted' })
          await fetchCustomers()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete customer'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchCustomers]
  )

  const getCustomer = useCallback(async (id: string) => {
    try {
      const response = await customersApi.get(id) as ApiResponse<Customer>
      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch (error) {
      console.error('Failed to fetch customer:', error)
      return null
    }
  }, [])

  const searchCustomers = useCallback(async (query: string, activeOnly = true) => {
    if (!query) {
      return activeOnly ? customers.filter((c) => c.isActive) : customers
    }
    const lowerQuery = query.toLowerCase()
    return customers.filter(
      (c) =>
        (!activeOnly || c.isActive) &&
        (c.name.toLowerCase().includes(lowerQuery) ||
          c.phone?.toLowerCase().includes(lowerQuery) ||
          c.address?.toLowerCase().includes(lowerQuery))
    )
  }, [customers])

  const getSubscribedCustomers = useCallback(
    async (shift?: 'MORNING' | 'EVENING') => {
      return customers.filter((c) => {
        if (!c.isActive) return false
        if (shift === 'MORNING') return !!c.subscriptionQtyAM
        if (shift === 'EVENING') return !!c.subscriptionQtyPM
        return !!c.subscriptionQtyAM || !!c.subscriptionQtyPM
      })
    },
    [customers]
  )

  return {
    customers,
    activeCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomer,
    searchCustomers,
    getSubscribedCustomers,
    fetchCustomers,
    isLoading,
    error
  }
}

export default useCustomers
