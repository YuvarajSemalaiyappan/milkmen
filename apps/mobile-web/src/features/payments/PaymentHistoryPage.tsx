import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IndianRupee, Trash2, Calendar, Sun, Moon } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { useFarmers, useCustomers, usePayments } from '@/hooks'
import { formatCurrency } from '@/utils'
import type { Payment } from '@/types'

export function PaymentHistoryPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { getFarmer } = useFarmers()
  const { getCustomer } = useCustomers()
  const { getPaymentsByFarmer, getPaymentsByCustomer, deletePayment } = usePayments()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [person, setPerson] = useState<{ name: string; type: 'farmer' | 'customer' } | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const farmerId = searchParams.get('farmerId')
  const customerId = searchParams.get('customerId')

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        if (farmerId) {
          const farmer = await getFarmer(farmerId)
          if (farmer) setPerson({ name: farmer.name, type: 'farmer' })
          const data = await getPaymentsByFarmer(farmerId)
          setPayments(data)
        } else if (customerId) {
          const customer = await getCustomer(customerId)
          if (customer) setPerson({ name: customer.name, type: 'customer' })
          const data = await getPaymentsByCustomer(customerId)
          setPayments(data)
        }
      } catch (error) {
        console.error('Failed to load payment history:', error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [farmerId, customerId, getFarmer, getCustomer, getPaymentsByFarmer, getPaymentsByCustomer])

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id)
      await deletePayment(id)
      setPayments((prev) => prev.filter((p) => p.id !== id))
      setConfirmDeleteId(null)
    } catch (error) {
      console.error('Failed to delete payment:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const typeLabel = (p: Payment) => {
    switch (p.type) {
      case 'PAID_TO_FARMER': return t('payment.paidToFarmer')
      case 'RECEIVED_FROM_CUSTOMER': return t('payment.receivedFromCustomer')
      case 'ADVANCE_TO_FARMER': return t('payment.advanceToFarmer')
      case 'ADVANCE_FROM_CUSTOMER': return t('payment.advanceFromCustomer')
    }
  }

  const methodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return t('payment.cash')
      case 'UPI': return t('payment.upi')
      case 'BANK_TRANSFER': return t('payment.bank')
      case 'OTHER': return t('payment.other')
      default: return method
    }
  }

  const shiftBadge = (shift: string) => {
    if (shift === 'MORNING') return (
      <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
        <Sun className="w-3 h-3" />AM
      </span>
    )
    return (
      <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
        <Moon className="w-3 h-3" />PM
      </span>
    )
  }

  return (
    <AppShell title={person?.name ? `${t('payment.history')} - ${person.name}` : t('payment.history')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">{t('common.loading')}...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12">
            <IndianRupee className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">{t('payment.noPayments')}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {payments.length} {t('payment.entries')}
            </p>
            {payments.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(p.amount)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.type.includes('ADVANCE')
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      }`}>
                        {typeLabel(p)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {p.date}
                      </span>
                      <span>{methodLabel(p.method)}</span>
                    </div>
                    {p.periodFromDate && p.periodToDate && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <span>{t('payment.dateFilter')}:</span>
                        <span>{p.periodFromDate}</span>
                        {p.periodFromShift && shiftBadge(p.periodFromShift)}
                        <span>→</span>
                        <span>{p.periodToDate}</span>
                        {p.periodToShift && shiftBadge(p.periodToShift)}
                      </div>
                    )}
                    {p.notes && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">{p.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmDeleteId(p.id)}
                    className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {confirmDeleteId === p.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      fullWidth
                      onClick={() => handleDelete(p.id)}
                      isLoading={deletingId === p.id}
                      className="!bg-red-600 hover:!bg-red-700"
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
    </AppShell>
  )
}
