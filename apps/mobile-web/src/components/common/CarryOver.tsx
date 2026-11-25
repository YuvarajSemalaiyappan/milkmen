import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/utils/format'

// Advance / pending carried over from earlier payments (GET /payments/summary). Explains why the
// balance differs from the unpaid entries: advance is taken off the next payment, pending is added.
export function CarryOver({ advance, pending }: { advance: number; pending: number }) {
  const { t } = useTranslation()
  if (!(advance > 0) && !(pending > 0)) return null
  return (
    <div className="mt-3 pt-3 border-t border-black/10 space-y-1 text-sm">
      {advance > 0 && (
        <div className="flex justify-between">
          <div>
            <p className="font-medium text-green-700">{t('payment.advanceCarried')}</p>
            <p className="text-xs text-gray-500">{t('payment.advanceNote')}</p>
          </div>
          <p className="font-semibold text-green-700">{formatCurrency(advance)}</p>
        </div>
      )}
      {pending > 0 && (
        <div className="flex justify-between">
          <div>
            <p className="font-medium text-red-700">{t('payment.pendingCarried')}</p>
            <p className="text-xs text-gray-500">{t('payment.pendingNote')}</p>
          </div>
          <p className="font-semibold text-red-700">{formatCurrency(pending)}</p>
        </div>
      )}
    </div>
  )
}
