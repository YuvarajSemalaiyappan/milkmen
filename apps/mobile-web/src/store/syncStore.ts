import { create } from 'zustand'

interface SyncState {
  // Sync status
  isSyncing: boolean
  lastSyncAt: number | null
  pendingCount: number
  failedCount: number

  // Sync progress
  currentTable: string | null
  processedCount: number
  totalCount: number

  // Error tracking
  lastError: string | null

  // Actions
  startSync: () => void
  finishSync: (success: boolean, error?: string) => void
  updateProgress: (table: string, processed: number, total: number) => void
  setPendingCount: (count: number) => void
  setFailedCount: (count: number) => void
  clearError: () => void
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  lastSyncAt: null,
  pendingCount: 0,
  failedCount: 0,
  currentTable: null,
  processedCount: 0,
  totalCount: 0,
  lastError: null,

  startSync: () => {
    set({
      isSyncing: true,
      currentTable: null,
      processedCount: 0,
      totalCount: 0,
      lastError: null
    })
  },

  finishSync: (success, error) => {
    set({
      isSyncing: false,
      lastSyncAt: success ? Date.now() : null,
      currentTable: null,
      lastError: error || null
    })
  },

  updateProgress: (table, processed, total) => {
    set({
      currentTable: table,
      processedCount: processed,
      totalCount: total
    })
  },

  setPendingCount: (pendingCount) => set({ pendingCount }),

  setFailedCount: (failedCount) => set({ failedCount }),

  clearError: () => set({ lastError: null })
}))

// Helper selectors
export const selectSyncStatus = (state: SyncState) => {
  if (state.isSyncing) return 'syncing'
  if (state.failedCount > 0) return 'failed'
  if (state.pendingCount > 0) return 'pending'
  return 'synced'
}

export const selectSyncProgress = (state: SyncState) => {
  if (state.totalCount === 0) return 0
  return Math.round((state.processedCount / state.totalCount) * 100)
}
