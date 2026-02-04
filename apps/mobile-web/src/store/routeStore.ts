import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface RouteState {
  selectedRouteId: string | null
  setSelectedRoute: (routeId: string | null) => void
}

export const useRouteStore = create<RouteState>()(
  persist(
    (set) => ({
      selectedRouteId: null,
      setSelectedRoute: (selectedRouteId) => set({ selectedRouteId })
    }),
    {
      name: 'milkmen_route',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
