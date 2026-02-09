import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface RouteState {
  selectedRouteId: string | null
  setSelectedRoute: (routeId: string | null) => void
  selectedAreaId: string | null
  setSelectedArea: (areaId: string | null) => void
}

export const useRouteStore = create<RouteState>()(
  persist(
    (set) => ({
      selectedRouteId: null,
      setSelectedRoute: (selectedRouteId) => set({ selectedRouteId, selectedAreaId: null }),
      selectedAreaId: null,
      setSelectedArea: (selectedAreaId) => set({ selectedAreaId })
    }),
    {
      name: 'milkmen_route',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
