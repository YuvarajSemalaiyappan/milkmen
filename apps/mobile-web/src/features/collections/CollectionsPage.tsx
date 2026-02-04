import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Milk } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card, StatCard } from '@/components/ui'
import { ShiftToggle, EmptyState, RouteFilter } from '@/components/common'
import { useAppStore } from '@/store'

export function CollectionsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)

  // TODO: Replace with actual data
  const collections: unknown[] = []
  const todayTotal = { liters: 0, amount: 0 }

  return (
    <AppShell
      title={t('collection.title')}
      rightAction={
        <Button
          size="sm"
          onClick={() => navigate('/collect/add')}
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

        {/* Today's Total */}
        <StatCard
          title={t('collection.todayTotal')}
          value={`${todayTotal.liters} ${t('common.liter')}`}
          subtitle={`₹${todayTotal.amount.toLocaleString('en-IN')}`}
          icon={<Milk className="w-6 h-6" />}
          color="blue"
        />

        {/* Collections List */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('collection.history')}
          </h2>
          {collections.length === 0 ? (
            <EmptyState
              icon={<Milk className="w-12 h-12" />}
              title={t('collection.noCollections')}
              action={{
                label: t('collection.addCollection'),
                onClick: () => navigate('/collect/add')
              }}
            />
          ) : (
            <div className="space-y-3">
              {/* Collection items will be rendered here */}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
