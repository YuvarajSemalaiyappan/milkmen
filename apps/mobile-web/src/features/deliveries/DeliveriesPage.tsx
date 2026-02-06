import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Truck, CheckCircle, User } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card, StatCard } from '@/components/ui'
import { ShiftToggle, EmptyState, RouteFilter } from '@/components/common'
import { useAppStore } from '@/store'
import { useDeliveries, useCustomers } from '@/hooks'
import { formatCurrency } from '@/utils'

export function DeliveriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)

  const { todayDeliveries, todayTotals, isLoading } = useDeliveries()
  const { customers } = useCustomers()

  // Filter deliveries by current shift
  const shiftDeliveries = todayDeliveries.filter(
    (d) => d.data.shift === currentShift
  )
  const pendingCount = shiftDeliveries.filter(
    (d) => d.data.status === 'PENDING'
  ).length

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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title={t('delivery.todayTotal')}
            value={`${todayTotals.liters} ${t('common.liter')}`}
            subtitle={formatCurrency(todayTotals.amount)}
            icon={<Truck className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title={t('delivery.pending')}
            value={pendingCount.toString()}
            icon={<CheckCircle className="w-6 h-6" />}
            color="yellow"
          />
        </div>

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
