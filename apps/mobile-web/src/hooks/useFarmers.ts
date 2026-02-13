import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateLocalId, now } from '@/db/localDb'
import { syncService } from '@/services/syncService'
import { useAppStore } from '@/store'
import type { LocalFarmer } from '@/types'

export function useFarmers() {
  const addToast = useAppStore((state) => state.addToast)

  // Live query from IndexedDB
  const farmers = useLiveQuery(
    () => db.farmers.orderBy('updatedAt').reverse().toArray(),
    []
  )

  const activeFarmers = useLiveQuery(
    () => db.farmers.filter((f) => f.data.isActive).toArray(),
    []
  )

  // Add new farmer
  const addFarmer = useCallback(
    async (data: {
      name: string
      phone?: string
      village?: string
      defaultRate: number
      collectAM?: boolean
      collectPM?: boolean
    }) => {
      const localId = generateLocalId()
      const timestamp = now()

      const farmer: LocalFarmer = {
        id: localId, // Will be replaced with server ID after sync
        localId,
        syncStatus: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
        data: {
          name: data.name,
          phone: data.phone,
          village: data.village,
          defaultRate: data.defaultRate,
          collectAM: data.collectAM ?? true,
          collectPM: data.collectPM ?? false,
          isActive: true,
          balance: 0
        }
      }

      await db.farmers.add(farmer)

      // Queue for sync
      await syncService.queueSync('farmers', localId, 'create', {
        ...data,
        localId
      })

      addToast({ type: 'success', message: 'Farmer added' })
      return farmer
    },
    [addToast]
  )

  // Update farmer
  const updateFarmer = useCallback(
    async (
      id: string,
      updates: Partial<{
        name: string
        phone?: string
        village?: string
        defaultRate: number
        collectAM: boolean
        collectPM: boolean
        isActive: boolean
      }>
    ) => {
      const farmer = await db.farmers.get(id)
      if (!farmer) throw new Error('Farmer not found')

      const timestamp = now()
      const updatedFarmer: LocalFarmer = {
        ...farmer,
        syncStatus: 'PENDING',
        updatedAt: timestamp,
        data: { ...farmer.data, ...updates }
      }

      await db.farmers.put(updatedFarmer)

      // Queue for sync - include phone so server can resolve local_ IDs
      await syncService.queueSync('farmers', farmer.localId, 'update', {
        id: farmer.id,
        phone: farmer.data.phone,
        ...updates
      })

      addToast({ type: 'success', message: 'Farmer updated' })
      return updatedFarmer
    },
    [addToast]
  )

  // Delete farmer (soft delete)
  const deleteFarmer = useCallback(
    async (id: string) => {
      const farmer = await db.farmers.get(id)
      if (!farmer) throw new Error('Farmer not found')

      // Soft delete - mark as inactive
      await updateFarmer(id, { isActive: false })

      addToast({ type: 'success', message: 'Farmer deleted' })
    },
    [updateFarmer, addToast]
  )

  // Get farmer by ID
  const getFarmer = useCallback(async (id: string) => {
    return db.farmers.get(id)
  }, [])

  // Search farmers
  const searchFarmers = useCallback(async (query: string, activeOnly = true) => {
    if (!query) {
      if (activeOnly) return db.farmers.filter((f) => f.data.isActive).toArray()
      return db.farmers.orderBy('updatedAt').reverse().toArray()
    }

    const lowerQuery = query.toLowerCase()
    return db.farmers
      .filter(
        (f) =>
          (!activeOnly || !!f.data.isActive) &&
          (f.data.name.toLowerCase().includes(lowerQuery) ||
            !!f.data.phone?.toLowerCase().includes(lowerQuery) ||
            !!f.data.village?.toLowerCase().includes(lowerQuery))
      )
      .toArray()
  }, [])

  return {
    farmers: farmers || [],
    activeFarmers: activeFarmers || [],
    addFarmer,
    updateFarmer,
    deleteFarmer,
    getFarmer,
    searchFarmers,
    isLoading: farmers === undefined
  }
}

export default useFarmers
