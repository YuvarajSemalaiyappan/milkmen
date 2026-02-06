import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Shift } from '@/types'

export type Theme = 'light' | 'dark' | 'system'

interface AppState {
  // Network status
  isOnline: boolean

  // Current shift (auto-detected or manually set)
  currentShift: Shift

  // Selected date for operations (defaults to today)
  selectedDate: string

  // UI state
  isSidebarOpen: boolean
  isBottomSheetOpen: boolean

  // Theme
  theme: Theme

  // Toasts/notifications
  toasts: Toast[]

  // Actions
  setOnline: (online: boolean) => void
  setCurrentShift: (shift: Shift) => void
  setSelectedDate: (date: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setBottomSheetOpen: (open: boolean) => void
  setTheme: (theme: Theme) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

// Default shift (user manually selects based on subscription they want to work with)
function getDefaultShift(): Shift {
  return 'MORNING'
}

// Get today's date in YYYY-MM-DD format
function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

// Generate unique ID for toasts
function generateToastId(): string {
  return `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      currentShift: getDefaultShift(),
      selectedDate: getToday(),
      isSidebarOpen: false,
      isBottomSheetOpen: false,
      theme: 'system' as Theme,
      toasts: [],

      setOnline: (isOnline) => set({ isOnline }),

      setCurrentShift: (currentShift) => set({ currentShift }),

      setSelectedDate: (selectedDate) => set({ selectedDate }),

      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

      setBottomSheetOpen: (isBottomSheetOpen) => set({ isBottomSheetOpen }),

      setTheme: (theme) => set({ theme }),

      addToast: (toast) => {
        const id = generateToastId()
        const newToast: Toast = { ...toast, id }

        set((state) => ({
          toasts: [...state.toasts, newToast]
        }))

        // Auto-remove toast after duration
        const duration = toast.duration ?? 3000
        if (duration > 0) {
          setTimeout(() => {
            get().removeToast(id)
          }, duration)
        }
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }))
      },

      clearToasts: () => set({ toasts: [] })
    }),
    {
      name: 'milkmen_app',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentShift: state.currentShift,
        selectedDate: state.selectedDate,
        theme: state.theme
      })
    }
  )
)

// Setup online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().setOnline(true)
    useAppStore.getState().addToast({
      type: 'success',
      message: 'Back online',
      duration: 2000
    })
  })

  window.addEventListener('offline', () => {
    useAppStore.getState().setOnline(false)
    useAppStore.getState().addToast({
      type: 'warning',
      message: 'You are offline',
      duration: 3000
    })
  })
}
