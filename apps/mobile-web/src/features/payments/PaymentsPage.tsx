import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, CreditCard, User, UserCircle, Calendar, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card, Badge } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { usePayments, useFarmers, useCustomers } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils'
import type { LocalPayment } from '@/types'

export function PaymentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { payments, isLoading } = usePayments()
  const { activeFarmers } = useFarmers()
  const { activeCustomers } = useCustomers()

  // Get recent payments (last 50)
  const recentPayments = payments.slice(0, 50)

  const getFarmerName = (farmerId?: string) => {
    if (!farmerId) return null
    const farmer = activeFarmers.find((f) => f.id === farmerId)
    return farmer?.data.name
  }

  const getCustomerName = (customerId?: string) => {
    if (!customerId) return null
    const customer = activeCustomers.find((c) => c.id === customerId)
    return customer?.data.name
  }

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'PAID_TO_FARMER':
        return t('payment.paidToFarmer')
      case 'RECEIVED_FROM_CUSTOMER':
        return t('payment.receivedFromCustomer')
      case 'ADVANCE_TO_FARMER':
        return t('payment.advanceToFarmer')
      case 'ADVANCE_FROM_CUSTOMER':
        return t('payment.advanceFromCustomer')
      default:
        return type
    }
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH':
        return t('payment.cash')
      case 'UPI':
        return 'UPI'
      case 'BANK_TRANSFER':
        return t('payment.banktransfer')
      default:
        return method
    }
  }

  return (
    <AppShell
      title={t('payment.title')}
      rightAction={
        <Button
          size="sm"
          onClick={() => navigate('/payments/add')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('common.add')}
        </Button>
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/payments/add?type=farmer')}
            fullWidth
            leftIcon={<ArrowUpRight className="w-4 h-4 text-red-500" />}
          >
            {t('payment.payFarmer')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/payments/add?type=customer')}
            fullWidth
            leftIcon={<ArrowDownLeft className="w-4 h-4 text-green-500" />}
          >
            {t('payment.receiveCustomer')}
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('common.loading')}...
          </div>
        )}

        {/* Payments List */}
        {!isLoading && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('payment.history')}
            </h2>
            {recentPayments.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="w-12 h-12" />}
                title={t('payment.noPayments')}
                action={{
                  label: t('payment.addPayment'),
                  onClick: () => navigate('/payments/add')
                }}
              />
            ) : (
              <div className="space-y-3">
                {recentPayments.map((payment) => {
                  const isFarmerPayment = !!payment.data.farmerId
                  const name = isFarmerPayment
                    ? getFarmerName(payment.data.farmerId)
                    : getCustomerName(payment.data.customerId)
                  const isOutgoing = payment.data.type === 'PAID_TO_FARMER' || payment.data.type === 'ADVANCE_TO_FARMER'

                  return (
                    <div
                      key={payment.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isFarmerPayment ? 'bg-green-100 dark:bg-green-900/50' : 'bg-blue-100 dark:bg-blue-900/50'
                      }`}>
                        {isFarmerPayment ? (
                          <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {name || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(payment.data.date)}</span>
                          <Badge size="sm" variant="default">
                            {getMethodLabel(payment.data.method)}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`font-semibold ${isOutgoing ? 'text-red-600' : 'text-green-600'}`}>
                          {isOutgoing ? '-' : '+'}{formatCurrency(payment.data.amount)}
                        </p>
                        {payment.syncStatus === 'PENDING' && (
                          <Badge size="sm" variant="warning">Pending</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  )
}
