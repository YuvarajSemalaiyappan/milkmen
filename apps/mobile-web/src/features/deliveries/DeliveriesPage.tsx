import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Truck, User } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { ShiftToggle, EmptyState, RouteFilter } from '@/components/common'
import { useAppStore, useRouteStore } from '@/store'
import { useDeliveries, useCustomers, useRouteCustomerIds } from '@/hooks'
import { formatCurrency } from '@/utils'

export function DeliveriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)

  const { todayDeliveries, isLoading } = useDeliveries()
  const { customers } = useCustomers()
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)
  const { customerIds: routeCustomerIds } = useRouteCustomerIds(selectedRouteId, selectedAreaId)

  // Filter deliveries by route/area
  const filteredDeliveries = useMemo(() => {
    if (!routeCustomerIds) return todayDeliveries
    return todayDeliveries.filter(d => routeCustomerIds.has(d.data.customerId))
  }, [todayDeliveries, routeCustomerIds])

  // Shift-specific totals
  const calcShiftTotals = (shift: 'MORNING' | 'EVENING') => {
    const filtered = filteredDeliveries.filter(d => d.data.shift === shift)
    return {
      liters: filtered.reduce((sum, d) => sum + Number(d.data.quantity), 0),
      amount: filtered.reduce((sum, d) => sum + Number(d.data.totalAmount), 0)
    }
  }
  const amTotals = calcShiftTotals('MORNING')
  const pmTotals = calcShiftTotals('EVENING')
  const totalLiters = amTotals.liters + pmTotals.liters
  const totalAmount = amTotals.amount + pmTotals.amount

  // Filter deliveries by current shift
  const shiftDeliveries = filteredDeliveries.filter(
    (d) => d.data.shift === currentShift
  )

  // Helper to get customer name
  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId)
    return customer?.data.name || 'Unknown'
  }

  return (
    <AppShell
      title={t('delivery.title')}
      rightAction={
        <Button
          size="sm"
          onClick={() => navigate('/deliver/add')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('common.add')}
        </Button>
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Shift Toggle */}
        <ShiftToggle
          value={currentShift}
          onChange={setCurrentShift}
          fullWidth
        />

        {/* Route Filter */}
        <RouteFilter />

        {/* Stats with AM/PM breakdown */}
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-50 to-green-100 text-green-600">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('delivery.todayTotal')}</h3>
          </div>
          <div className="space-y-1.5">
            <div className={`flex justify-between text-sm ${currentShift === 'MORNING' ? 'font-semibold' : ''}`}>
              <span className="text-gray-500 dark:text-gray-400">{t('common.morning')}</span>
              <span className={currentShift === 'MORNING' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}>{amTotals.liters.toFixed(1)}{t('common.liter')} &middot; {formatCurrency(amTotals.amount)}</span>
            </div>
            <div className={`flex justify-between text-sm ${currentShift === 'EVENING' ? 'font-semibold' : ''}`}>
              <span className="text-gray-500 dark:text-gray-400">{t('common.evening')}</span>
              <span className={currentShift === 'EVENING' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}>{pmTotals.liters.toFixed(1)}{t('common.liter')} &middot; {formatCurrency(pmTotals.amount)}</span>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-1.5 flex justify-between text-sm font-bold">
              <span className="text-gray-700 dark:text-gray-300">{t('common.total')}</span>
              <span className="text-green-600 dark:text-green-400">{totalLiters.toFixed(1)}{t('common.liter')} &middot; {formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </Card>

        {/* Deliveries List */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('delivery.todayDeliveries')}
            </h2>
            {shiftDeliveries.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/deliver/today')}
              >
                {t('common.viewAll')}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              {t('common.loading')}...
            </div>
          ) : shiftDeliveries.length === 0 ? (
            <EmptyState
              icon={<Truck className="w-12 h-12" />}
              title={t('delivery.noDeliveries')}
              action={{
                label: t('delivery.generateFromSubscription'),
                onClick: () => navigate('/deliver/today')
              }}
            />
          ) : (
            <div className="space-y-3">
              {shiftDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => navigate(`/deliver/edit/${delivery.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getCustomerName(delivery.data.customerId)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {delivery.data.quantity}L @ {formatCurrency(delivery.data.ratePerLiter)}/L
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary-600">
                      {formatCurrency(delivery.data.totalAmount)}
                    </p>
                    <p className={`text-xs ${
                      delivery.data.status === 'DELIVERED'
                        ? 'text-green-600'
                        : delivery.data.status === 'SKIPPED'
                        ? 'text-yellow-600'
                        : 'text-gray-500'
                    }`}>
                      {delivery.data.status === 'DELIVERED'
                        ? t('delivery.delivered')
                        : delivery.data.status === 'SKIPPED'
                        ? t('delivery.skipped')
                        : t('delivery.pending')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
