import { useEffect, useState } from 'react'
import { routesApi } from '@/services/api'
import type { ApiResponse, RouteScope } from '@/types'

// Who is on a route and in which area, from GET /routes/:id?scope=1 (ids and areas only).
// Use this when a screen only filters by route; screens that show the route's people with their
// details use routesApi.get. Same request as the phone app's route filter.
export function useRouteScope(routeId: string | null) {
  // Keyed by route so a stale answer for another route is never shown (no setState in the effect body)
  const [loaded, setLoaded] = useState<{ routeId: string; scope: RouteScope | null } | null>(null)

  useEffect(() => {
    if (!routeId) return
    let cancelled = false
    routesApi
      .getScope(routeId)
      .then((res) => {
        if (!cancelled) setLoaded({ routeId, scope: (res as ApiResponse<RouteScope>).data ?? null })
      })
      .catch((error) => {
        console.error('Failed to fetch route scope:', error)
        if (!cancelled) setLoaded({ routeId, scope: null })
      })
    return () => {
      cancelled = true
    }
  }, [routeId])

  const current = routeId && loaded?.routeId === routeId ? loaded : null
  return { scope: current?.scope ?? null, isLoading: !!routeId && !current }
}
