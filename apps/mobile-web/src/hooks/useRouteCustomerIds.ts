import { useMemo } from 'react'
import { useRouteScope } from './useRouteScope'

// Customer ids on a route (and area, if given); null when no route is chosen or it hasn't loaded
export function useRouteCustomerIds(routeId: string | null, areaId: string | null) {
  const { scope, isLoading } = useRouteScope(routeId)
  const customerIds = useMemo(() => {
    if (!scope) return null
    return new Set(scope.routeCustomers.filter((rc) => !areaId || rc.areaId === areaId).map((rc) => rc.customerId))
  }, [scope, areaId])
  return { customerIds, isLoading }
}
