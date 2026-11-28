import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, MapPin, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, InlineLoader } from '@/components/ui'
import { ShiftToggle, RouteFilter, SortableList, ShiftBadge, OrderShare } from '@/components/common'
import { useAppStore, useRouteStore } from '@/store'
import { useSortOrder } from '@/hooks/useSortOrder'
import { deliveriesApi } from '@/services/api'
import { useCustomers, useRouteCustomerIds } from '@/hooks'
import { getToday } from '@/utils/format'
import type { ApiResponse, Delivery, DeliveryStatus } from '@/types'
import { formatCurrency } from '@/utils'

type DeliveryRow = Delivery & { customer?: { name: string } }

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  SKIPPED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
}

// Deliveries for today and the chosen shift: customers still to deliver at the top (drag to
// reorder), deliveries already saved below. Works with or without a route; the route/area filter
// narrows both lists. Same layout as the phone app's Deliver tab. A cancelled delivery doesn't
// count as done (same rule as the server's duplicate check); a skipped one does.
export function DeliveriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const { activeCustomers, isLoading: customersLoading } = useCustomers()
  const { customerIds: routeCustomerIds } = useRouteCustomerIds(selectedRouteId, selectedAreaId)
  const { applySortOrder, saveSortOrder, following, reload } = useSortOrder('customer', currentShift)

  // Today's deliveries (the whole day: a day is a bounded list)
  const [todayDeliveries, setTodayDeliveries] = useState<DeliveryRow[] | null>(null)
  useEffect(() => {
    let cancelled = false
    deliveriesApi
      .list({ date: getToday() })
      .then((res) => {
        const data = (res as ApiResponse<DeliveryRow[]>).data
        if (!cancelled) setTodayDeliveries(data ?? [])
      })
      .catch((error) => {
        console.error('Failed to fetch today deliveries:', error)
        if (!cancelled) setTodayDeliveries([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const inScope = useCallback((customerId: string) => !routeCustomerIds || routeCustomerIds.has(customerId), [routeCustomerIds])

  // Saved this shift, in the chosen route/area
  const done = useMemo(
    () => (todayDeliveries ?? []).filter((d) => d.shift === currentShift && inScope(d.customerId)),
    [todayDeliveries, currentShift, inScope]
  )

  // Customers in the route/area with a daily quantity for this shift and no delivery yet
  const pendingCustomers = useMemo(() => {
    const doneIds = new Set(done.filter((d) => d.status !== 'CANCELLED').map((d) => d.customerId))
    return activeCustomers.filter((c) => {
      const qty = Number(currentShift === 'MORNING' ? c.subscriptionQtyAM : c.subscriptionQtyPM) || 0
      return inScope(c.id) && qty > 0 && !doneIds.has(c.id)
    })
  }, [activeCustomers, done, currentShift, inScope])

  const customerMap = useMemo(() => new Map(pendingCustomers.map((c) => [c.id, c])), [pendingCustomers])
  const sortedCustomerIds = useMemo(
    () => applySortOrder(pendingCustomers.map((c) => ({ id: c.id }))).map((i) => i.id),
    [pendingCustomers, applySortOrder]
  )
  const isLoading = customersLoading || todayDeliveries === null

  const handleReorder = useCallback((newIds: string[]) => {
    saveSortOrder(newIds)
  }, [saveSortOrder])

  return (
    <AppShell title={t('delivery.title')}>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Shift Toggle */}
        <ShiftToggle
          value={currentShift}
          onChange={setCurrentShift}
          fullWidth
        />

        {/* Route Filter (includes Area Filter) */}
        <RouteFilter />

        {/* Follow or copy someone's order (see components/common/OrderShare.tsx) */}
        <OrderShare kind="customer" onChanged={reload} />

        {isLoading ? (
          <div className="text-center py-8 text-gray-500"><InlineLoader label={t('common.loading')} /></div>
        ) : (
          <>
            {/* Still to deliver (drag to reorder) */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                {t('delivery.toDeliver')} ({pendingCustomers.length})
              </h3>
              {pendingCustomers.length === 0 ? (
                <p className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">{t('delivery.allCompleted')}</p>
              ) : (
                <SortableList
                  items={sortedCustomerIds}
                  onReorder={handleReorder}
                  disabled={!!following}
                  renderItem={(id) => {
                    const customer = customerMap.get(id)
                    if (!customer) return null
                    const qty = currentShift === 'MORNING' ? customer.subscriptionQtyAM : customer.subscriptionQtyPM
                    return (
                      <Card
                        className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                        onClick={() => navigate(`/deliver/add?customerId=${customer.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{customer.name}</p>
                              <ShiftBadge shift={currentShift} label={`${qty}L`} />
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                              {customer.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {customer.phone}
                                </span>
                              )}
                              {customer.address && (
                                <span className="flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  {customer.address}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                        </div>
                      </Card>
                    )
                  }}
                />
              )}
            </div>

            {/* Already saved */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                {t('delivery.deliveredList')} ({done.length})
              </h3>
              {done.length === 0 ? (
                <p className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">{t('delivery.noDeliveries')}</p>
              ) : (
                <Card padding="none">
                  {done.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/deliver/${d.id}`)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left border-b last:border-b-0 border-gray-100 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {d.customer?.name ?? activeCustomers.find((c) => c.id === d.customerId)?.name ?? t('common.unknown')}
                          </p>
                          <ShiftBadge shift={d.shift} />
                          {d.status !== 'DELIVERED' && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[d.status]}`}>
                              {d.status === 'SKIPPED' ? t('delivery.skipped') : t('delivery.cancelled')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {Number(d.quantity)} L × ₹{Number(d.ratePerLiter).toFixed(2)}
                        </p>
                      </div>
                      <span className={`font-semibold ml-2 ${d.status === 'DELIVERED' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                        {formatCurrency(Number(d.totalAmount))}
                      </span>
                    </button>
                  ))}
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
