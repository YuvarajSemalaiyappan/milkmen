import { useTranslation } from 'react-i18next'
import { Milk, Truck, CreditCard, Plus, Crown, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { StatCard, Card, Badge } from '@/components/ui'
import { ShiftToggle } from '@/components/common'
import { useAppStore, useAuthStore } from '@/store'
import { useCollections, useDeliveries, useFarmers, useCustomers } from '@/hooks'
import { formatCurrency } from '@/utils'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)
  const user = useAuthStore((state) => state.user)
  const subscription = useAuthStore((state) => state.subscription)

  const { todayTotals: collectionTotals, todayCollections } = useCollections()
  const { todayTotals: deliveryTotals, todayDeliveries } = useDeliveries()
  const { activeFarmers } = useFarmers()
  const { activeCustomers } = useCustomers()

  // Calculate pending dues
  const farmerDues = activeFarmers.reduce((sum, f) => sum + Math.max(0, f.data.balance), 0)
  const customerDues = activeCustomers.reduce((sum, c) => sum + Math.max(0, c.data.balance), 0)

  // Get recent activity (combine collections and deliveries)
  const recentActivity = [
    ...todayCollections.map((c) => ({
      type: 'collection' as const,
      id: c.id,
      name: activeFarmers.find((f) => f.id === c.data.farmerId)?.data.name || 'Unknown',
      quantity: c.data.quantity,
      amount: c.data.totalAmount,
      time: c.createdAt
    })),
    ...todayDeliveries.map((d) => ({
      type: 'delivery' as const,
      id: d.id,
      name: activeCustomers.find((c) => c.id === d.data.customerId)?.data.name || 'Unknown',
      quantity: d.data.quantity,
      amount: d.data.totalAmount,
      time: d.createdAt
    }))
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 5)

  const quickActions = [
    {
      label: t('collection.addCollection'),
      icon: Milk,
      path: '/collect/add',
      color: 'bg-blue-50 text-blue-600'
    },
    {
      label: t('delivery.title'),
      icon: Truck,
      path: '/deliver',
      color: 'bg-green-50 text-green-600'
    },
    {
      label: t('farmer.addNew'),
      icon: Plus,
      path: '/farmers/add',
      color: 'bg-purple-50 text-purple-600'
    },
    {
      label: t('payment.addPayment'),
      icon: CreditCard,
      path: '/payments/add',
      color: 'bg-amber-50 text-amber-600'
    }
  ]

  return (
    <AppShell title={t('dashboard.title')}>
      <div className="px-4 pt-5 pb-4 space-y-5">
        {/* Welcome */}
        {user && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('dashboard.welcome')}, {user.name?.split(' ')[0]}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        )}

        {/* Plan Card */}
        {subscription && (
          <div
            onClick={() => navigate('/settings/subscription')}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              subscription.daysRemaining <= 0
                ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700'
                : subscription.daysRemaining <= 7
                  ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'
                  : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              subscription.daysRemaining <= 0
                ? 'bg-red-100 dark:bg-red-900/50'
                : subscription.daysRemaining <= 7
                  ? 'bg-amber-100 dark:bg-amber-900/50'
                  : 'bg-blue-100 dark:bg-blue-900/50'
            }`}>
              {subscription.daysRemaining <= 7 && subscription.daysRemaining > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ) : subscription.daysRemaining <= 0 ? (
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <Crown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                subscription.daysRemaining <= 0
                  ? 'text-red-700 dark:text-red-300'
                  : subscription.daysRemaining <= 7
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-blue-700 dark:text-blue-300'
              }`}>
                {subscription.plan} Plan
              </p>
              <p className={`text-xs ${
                subscription.daysRemaining <= 0
                  ? 'text-red-600 dark:text-red-400'
                  : subscription.daysRemaining <= 7
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-blue-600 dark:text-blue-400'
              }`}>
                {subscription.daysRemaining <= 0
                  ? 'Plan expired'
                  : subscription.daysRemaining <= 7
                    ? `Expiring soon - ${subscription.daysRemaining} days left`
                    : `${subscription.daysRemaining} days remaining`
                }
              </p>
            </div>
          </div>
        )}

        {/* Shift Toggle */}
        <ShiftToggle
          value={currentShift}
          onChange={setCurrentShift}
          fullWidth
          size="lg"
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title={t('dashboard.todayCollection')}
            value={`${Number(collectionTotals.liters).toFixed(1)} ${t('common.liter')}`}
            subtitle={formatCurrency(collectionTotals.amount)}
            icon={<Milk className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title={t('dashboard.todaySales')}
            value={`${Number(deliveryTotals.liters).toFixed(1)} ${t('common.liter')}`}
            subtitle={formatCurrency(deliveryTotals.amount)}
            icon={<Truck className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title={t('dashboard.pendingDues')}
            value={formatCurrency(customerDues)}
            subtitle={`${t('dashboard.toFarmers')}: ${formatCurrency(farmerDues)}`}
            icon={<CreditCard className="w-6 h-6" />}
            color="yellow"
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {t('dashboard.quickActions')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all active:scale-[0.98]"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${action.color}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 text-left leading-tight">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {t('dashboard.recentActivity')}
          </h3>
          <Card>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {t('dashboard.noActivity')}
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      item.type === 'collection' ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-green-100 dark:bg-green-900/50'
                    }`}>
                      {item.type === 'collection' ? (
                        <Milk className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Truck className="w-5 h-5 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {Number(item.quantity).toFixed(1)}L - {formatCurrency(item.amount)}
                      </p>
                    </div>
                    <Badge variant={item.type === 'collection' ? 'info' : 'success'} size="sm">
                      {item.type === 'collection' ? t('common.buy') : t('common.sell')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
