import { useState, useEffect, useCallback } from 'react'
import { routesApi } from '@/services/api'
import { useAppStore, useAuthStore } from '@/store'
import type { ApiResponse, RouteWithCounts } from '@/types'

export function useRoutes() {
  const addToast = useAppStore((state) => state.addToast)
  const user = useAuthStore((state) => state.user)
  const [routes, setRoutes] = useState<RouteWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const isOwner = user?.role === 'OWNER'
  const isManager = user?.role === 'MANAGER' || user?.role === 'OWNER'

  const fetchRoutes = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await routesApi.list({ active: 'true' }) as ApiResponse<RouteWithCounts[]>
      if (response.success && response.data) {
        setRoutes(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch routes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  const getRoute = useCallback(async (id: string) => {
    try {
      const response = await routesApi.get(id) as ApiResponse<unknown>
      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch (error) {
      console.error('Failed to fetch route:', error)
      return null
    }
  }, [])

  const createRoute = useCallback(async (data: { name: string; description?: string }) => {
    try {
      const response = await routesApi.create(data) as ApiResponse<RouteWithCounts>
      if (response.success) {
        addToast({ type: 'success', message: 'Route created' })
        await fetchRoutes()
        return response.data
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create route'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchRoutes])

  const updateRoute = useCallback(async (id: string, data: Partial<{ name: string; description?: string; isActive: boolean }>) => {
    try {
      const response = await routesApi.update(id, data) as ApiResponse<RouteWithCounts>
      if (response.success) {
        addToast({ type: 'success', message: 'Route updated' })
        await fetchRoutes()
        return response.data
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update route'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchRoutes])

  const deleteRoute = useCallback(async (id: string) => {
    try {
      const response = await routesApi.delete(id) as ApiResponse<void>
      if (response.success) {
        addToast({ type: 'success', message: 'Route deleted' })
        await fetchRoutes()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete route'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchRoutes])

  const assignUsers = useCallback(async (routeId: string, userIds: string[]) => {
    try {
      const response = await routesApi.assignUsers(routeId, userIds) as ApiResponse<void>
      if (response.success) {
        addToast({ type: 'success', message: 'Users assigned' })
        await fetchRoutes()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign users'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchRoutes])

  const removeUser = useCallback(async (routeId: string, userId: string) => {
    try {
      const response = await routesApi.removeUser(routeId, userId) as ApiResponse<void>
      if (response.success) {
        addToast({ type: 'success', message: 'User removed' })
        await fetchRoutes()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove user'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchRoutes])

  const assignFarmers = useCallback(async (routeId: string, farmerIds: string[], sortOrders?: Record<string, number>) => {
    try {
      const response = await routesApi.assignFarmers(routeId, farmerIds, sortOrders) as ApiResponse<void>
      if (response.success) {
        addToast({ type: 'success', message: 'Farmers assigned' })
        await fetchRoutes()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign farmers'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchRoutes])

  const removeFarmer = useCallback(async (routeId: string, farmerId: string) => {
    try {
      const response = await routesApi.removeFarmer(routeId, farmerId) as ApiResponse<void>
      if (response.success) {
        addToast({ type: 'success', message: 'Farmer removed' })
        await fetchRoutes()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove farmer'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchRoutes])

  const assignCustomers = useCallback(async (routeId: string, customerIds: string[], sortOrders?: Record<string, number>) => {
    try {
      const response = await routesApi.assignCustomers(routeId, customerIds, sortOrders) as ApiResponse<void>
      if (response.success) {
        addToast({ type: 'success', message: 'Customers assigned' })
        await fetchRoutes()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign customers'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchRoutes])

  const removeCustomer = useCallback(async (routeId: string, customerId: string) => {
    try {
      const response = await routesApi.removeCustomer(routeId, customerId) as ApiResponse<void>
      if (response.success) {
        addToast({ type: 'success', message: 'Customer removed' })
        await fetchRoutes()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove customer'
      addToast({ type: 'error', message })
      throw error
    }
  }, [addToast, fetchRoutes])

  return {
    routes,
    isLoading,
    isOwner,
    isManager,
    fetchRoutes,
    getRoute,
    createRoute,
    updateRoute,
    deleteRoute,
    assignUsers,
    removeUser,
    assignFarmers,
    removeFarmer,
    assignCustomers,
    removeCustomer
  }
}

export default useRoutes
