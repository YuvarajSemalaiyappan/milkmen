import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { IndianRupee, Trash2, Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { db } from '@/db/localDb'
import { usePayments } from '@/hooks'
import { formatCurrency } from '@/utils'
import type { LocalPayment } from '@/types'

export function PaymentHistoryPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { deletePayment } = usePayments()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const farmerId = searchParams.get('farmerId')
  const customerId = searchParams.get('customerId')

  const person = useLiveQuery(async () => {
    if (farmerId) {
      const f = await db.farmers.get(farmerId)
      return f ? { name: f.data.name, type: 'farmer' as const } : null
    }
    if (customerId) {
      const c = await db.customers.get(customerId)
      return c ? { name: c.data.name, type: 'customer' as const } : null
    }
    return null
  }, [farmerId, customerId])

  const payments = useLiveQuery(async () => {
    const all = await db.payments.orderBy('updatedAt').reverse().toArray()
    return all.filter(p => {
      if (farmerId) return p.data.farmerId === farmerId
      if (customerId) return p.data.customerId === customerId
      return false
    })
  }, [farmerId, customerId])

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id)
      await deletePayment(id)
      setConfirmDeleteId(null)
    } catch (error) {
      console.error('Failed to delete payment:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const typeLabel = (p: LocalPayment) => {
    switch (p.data.type) {
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

  return (
    <AppShell title={person?.name ? `${t('payment.history')} - ${person.name}` : t('payment.history')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-3">
        {!payments || payments.length === 0 ? (
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
                        {formatCurrency(p.data.amount)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.data.type.includes('ADVANCE')
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      }`}>
                        {typeLabel(p)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {p.data.date}
                      </span>
                      <span>{methodLabel(p.data.method)}</span>
                      {p.syncStatus === 'PENDING' && (
                        <span className="text-yellow-600 dark:text-yellow-400">{t('common.pending')}</span>
                      )}
                    </div>
                    {p.data.periodFromDate && p.data.periodToDate && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t('payment.dateFilter')}: {p.data.periodFromDate} → {p.data.periodToDate}
                      </p>
                    )}
                    {p.data.notes && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">{p.data.notes}</p>
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
