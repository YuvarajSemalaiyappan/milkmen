import { useMemo } from 'react'
import { useRouteScope } from './useRouteScope'

// Farmer ids on a route (and area, if given); null when no route is chosen or it hasn't loaded
export function useRouteFarmerIds(routeId: string | null, areaId: string | null) {
  const { scope, isLoading } = useRouteScope(routeId)
  const farmerIds = useMemo(() => {
    if (!scope) return null
    return new Set(scope.routeFarmers.filter((rf) => !areaId || rf.areaId === areaId).map((rf) => rf.farmerId))
  }, [scope, areaId])
  return { farmerIds, isLoading }
}
