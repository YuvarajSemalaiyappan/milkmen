import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, Calendar, Clock, AlertTriangle, Phone } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { useAuthStore } from '@/store'
import { subscriptionApi } from '@/services/api'
import type { SubscriptionPlan } from '@/types'

interface PlanPrice {
  plan: SubscriptionPlan
  amount: number
}

interface SubscriptionDetail {
  plan: SubscriptionPlan
  status: string
  active: boolean
  startDate: string | null
  endDate: string | null
  daysRemaining: number
  pricing: PlanPrice[]
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free Trial',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half Yearly',
  ANNUAL: 'Annual'
}

const PLAN_DAYS: Record<string, number> = {
  FREE: 30,
  MONTHLY: 30,
  QUARTERLY: 90,
  HALF_YEARLY: 180,
  ANNUAL: 365
}

export function SubscriptionPage() {
  const { t } = useTranslation()
  const subscription = useAuthStore((state) => state.subscription)
  const setSubscription = useAuthStore((state) => state.setSubscription)
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubscription()
  }, [])

  const loadSubscription = async () => {
    try {
      const result = await subscriptionApi.get() as { success: boolean; data: SubscriptionDetail }
      if (result.success) {
        setDetail(result.data)
        setSubscription({
          plan: result.data.plan,
          status: result.data.status as 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED',
          active: result.data.active,
          endDate: result.data.endDate,
          daysRemaining: result.data.daysRemaining
        })
      }
    } catch (err) {
      console.error('Failed to load subscription:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const currentPlan = detail || subscription

  return (
    <AppShell title={t('settings.subscription')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {t('common.loading')}
          </div>
        ) : (
          <>
            {/* Current Plan Card */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  !currentPlan?.active
                    ? 'bg-red-100 dark:bg-red-900/50'
                    : (currentPlan?.daysRemaining ?? 0) <= 7
                      ? 'bg-amber-100 dark:bg-amber-900/50'
                      : 'bg-blue-100 dark:bg-blue-900/50'
                }`}>
                  <Crown className={`w-6 h-6 ${
                    !currentPlan?.active
                      ? 'text-red-600 dark:text-red-400'
                      : (currentPlan?.daysRemaining ?? 0) <= 7
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-blue-600 dark:text-blue-400'
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {PLAN_LABELS[currentPlan?.plan || 'FREE']} Plan
                  </h3>
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                    currentPlan?.active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                  }`}>
                    {currentPlan?.status || 'INACTIVE'}
                  </span>
                </div>
              </div>

              {/* Plan Details */}
              <div className="space-y-3">
                {detail?.startDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Start Date</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDate(detail.startDate)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">End Date</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(currentPlan?.endDate || null)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Days Remaining</p>
                    <p className={`text-sm font-bold ${
                      (currentPlan?.daysRemaining ?? 0) <= 0
                        ? 'text-red-600 dark:text-red-400'
                        : (currentPlan?.daysRemaining ?? 0) <= 7
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-green-600 dark:text-green-400'
                    }`}>
                      {(currentPlan?.daysRemaining ?? 0) <= 0
                        ? 'Expired'
                        : `${currentPlan?.daysRemaining} days`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning Banner */}
              {currentPlan && currentPlan.daysRemaining <= 7 && currentPlan.daysRemaining > 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Your plan expires in {currentPlan.daysRemaining} days. Contact admin to upgrade your plan.
                  </p>
                </div>
              )}
              {currentPlan && currentPlan.daysRemaining <= 0 && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Your plan has expired. Contact admin to renew your subscription.
                  </p>
                </div>
              )}
            </Card>

            {/* Available Plans */}
            {detail?.pricing && detail.pricing.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Available Plans
                </h3>
                <div className="space-y-2">
                  {detail.pricing
                    .filter((p) => p.plan !== 'FREE')
                    .map((price) => (
                    <Card key={price.plan} className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {PLAN_LABELS[price.plan]}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {PLAN_DAYS[price.plan]} days
                        </p>
                      </div>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        ₹{price.amount}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Admin */}
            <Card className="text-center">
              <div className="p-2">
                <Phone className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="font-medium text-gray-900 dark:text-white mb-1">
                  Want to upgrade?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Contact admin to upgrade or renew your subscription plan.
                </p>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  )
}
