import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface RouteState {
  selectedRouteId: string | null
  selectedAreaId: string | null
  setSelectedRoute: (routeId: string | null) => void
  setSelectedArea: (areaId: string | null) => void
}

export const useRouteStore = create<RouteState>()(
  persist(
    (set) => ({
      selectedRouteId: null,
      selectedAreaId: null,
      setSelectedRoute: (selectedRouteId) => set({ selectedRouteId, selectedAreaId: null }),
      setSelectedArea: (selectedAreaId) => set({ selectedAreaId })
    }),
    {
      name: 'milkmen_route',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
