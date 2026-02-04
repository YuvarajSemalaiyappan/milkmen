import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Truck, CheckCircle } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card, StatCard } from '@/components/ui'
import { ShiftToggle, EmptyState, RouteFilter } from '@/components/common'
import { useAppStore } from '@/store'

export function DeliveriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)

  // TODO: Replace with actual data
  const deliveries: unknown[] = []
  const todayTotal = { liters: 0, amount: 0 }
  const pendingCount = 0

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
            value={`${todayTotal.liters} ${t('common.liter')}`}
            subtitle={`₹${todayTotal.amount.toLocaleString('en-IN')}`}
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
            {deliveries.length > 0 && (
              <Button variant="ghost" size="sm">
                {t('delivery.markAllDelivered')}
              </Button>
            )}
          </div>

          {deliveries.length === 0 ? (
            <EmptyState
              icon={<Truck className="w-12 h-12" />}
              title={t('delivery.noDeliveries')}
              action={{
                label: t('delivery.generateFromSubscription'),
                onClick: () => {/* TODO: Generate from subscriptions */}
              }}
            />
          ) : (
            <div className="space-y-3">
              {/* Delivery items will be rendered here */}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
