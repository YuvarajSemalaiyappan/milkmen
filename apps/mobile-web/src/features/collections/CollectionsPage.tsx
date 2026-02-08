import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Milk, User } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { ShiftToggle, EmptyState, RouteFilter } from '@/components/common'
import { useAppStore, useRouteStore } from '@/store'
import { useCollections, useFarmers, useRouteFarmerIds } from '@/hooks'
import { formatCurrency } from '@/utils'

export function CollectionsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)

  const { todayCollections, isLoading } = useCollections()
  const { farmers } = useFarmers()
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)
  const { farmerIds: routeFarmerIds } = useRouteFarmerIds(selectedRouteId, selectedAreaId)

  // Filter collections by route/area
  const filteredCollections = useMemo(() => {
    if (!routeFarmerIds) return todayCollections
    return todayCollections.filter(c => routeFarmerIds.has(c.data.farmerId))
  }, [todayCollections, routeFarmerIds])

  // Shift-specific totals
  const calcShiftTotals = (shift: 'MORNING' | 'EVENING') => {
    const filtered = filteredCollections.filter(c => c.data.shift === shift)
    return {
      liters: filtered.reduce((sum, c) => sum + Number(c.data.quantity), 0),
      amount: filtered.reduce((sum, c) => sum + Number(c.data.totalAmount), 0)
    }
  }
  const amTotals = calcShiftTotals('MORNING')
  const pmTotals = calcShiftTotals('EVENING')
  const totalLiters = amTotals.liters + pmTotals.liters
  const totalAmount = amTotals.amount + pmTotals.amount

  // Filter collections by current shift
  const shiftCollections = filteredCollections.filter(
    (c) => c.data.shift === currentShift
  )

  const getFarmerName = (farmerId: string) => {
    const farmer = farmers.find((f) => f.id === farmerId)
    return farmer?.data.name || t('common.unknown')
  }

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

        {/* Today's Total with AM/PM breakdown */}
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600">
              <Milk className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('collection.todayTotal')}</h3>
          </div>
          <div className="space-y-1.5">
            <div className={`flex justify-between text-sm ${currentShift === 'MORNING' ? 'font-semibold' : ''}`}>
              <span className="text-gray-500 dark:text-gray-400">{t('common.morning')}</span>
              <span className={currentShift === 'MORNING' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}>{amTotals.liters.toFixed(1)}{t('common.liter')} &middot; {formatCurrency(amTotals.amount)}</span>
            </div>
            <div className={`flex justify-between text-sm ${currentShift === 'EVENING' ? 'font-semibold' : ''}`}>
              <span className="text-gray-500 dark:text-gray-400">{t('common.evening')}</span>
              <span className={currentShift === 'EVENING' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}>{pmTotals.liters.toFixed(1)}{t('common.liter')} &middot; {formatCurrency(pmTotals.amount)}</span>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-1.5 flex justify-between text-sm font-bold">
              <span className="text-gray-700 dark:text-gray-300">{t('common.total')}</span>
              <span className="text-blue-600 dark:text-blue-400">{totalLiters.toFixed(1)}{t('common.liter')} &middot; {formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </Card>

        {/* Collections List */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('collection.history')}
          </h2>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              {t('common.loading')}...
            </div>
          ) : shiftCollections.length === 0 ? (
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
              {shiftCollections.map((collection) => (
                <div
                  key={collection.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => navigate(`/collect/edit/${collection.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getFarmerName(collection.data.farmerId)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {collection.data.quantity}L @ {formatCurrency(collection.data.ratePerLiter)}/L
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">
                      {formatCurrency(collection.data.totalAmount)}
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
