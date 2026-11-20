import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User, UserCircle, Calculator, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { NumberPad, ShiftToggle } from '@/components/common'
import { useFarmers, useCustomers, usePayments } from '@/hooks'
import { useAppStore } from '@/store'
import { formatCurrency, toLocalDateString } from '@/utils/format'
import { paymentsApi } from '@/services/api'
import type { Farmer, Customer, PaymentType, PaymentMethod, Shift, ApiResponse, PaymentPeriod } from '@/types'

type RecipientType = 'farmer' | 'customer'

function getToday(): string {
  return toLocalDateString(new Date())
}

export function AddPaymentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentShift = useAppStore((state) => state.currentShift)
  const initialShiftRef = useRef(currentShift)

  const { activeFarmers } = useFarmers()
  const { activeCustomers } = useCustomers()
  const { addPayment } = usePayments({ skipInitialFetch: true })

  const recipientType: RecipientType = (searchParams.get('type') as RecipientType) || 'farmer'
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAdvance, setIsAdvance] = useState(false)
  const [paymentDate, setPaymentDate] = useState(getToday)
  const [showConfirm, setShowConfirm] = useState(false)

  // Date+shift filter state
  const [fromDate, setFromDate] = useState(getToday)
  const [toDate, setToDate] = useState(getToday)
  const [fromShift, setFromShift] = useState<Shift>('MORNING')
  const [toShift, setToShift] = useState<Shift>(currentShift)
  const [periodAmount, setPeriodAmount] = useState<number | null>(null)
  const [periodCount, setPeriodCount] = useState(0)
  const [isCalculating, setIsCalculating] = useState(false)
  const [existingPaymentForPeriod, setExistingPaymentForPeriod] = useState(false)

  // Pre-select from URL params
  useEffect(() => {
    const farmerId = searchParams.get('farmerId')
    const customerId = searchParams.get('customerId')

    if (farmerId) {
      const farmer = activeFarmers.find((f) => f.id === farmerId)
      if (farmer) {
        setSelectedFarmer(farmer)
      }
    } else if (customerId) {
      const customer = activeCustomers.find((c) => c.id === customerId)
      if (customer) {
        setSelectedCustomer(customer)
      }
    }
  }, [searchParams, activeFarmers, activeCustomers])

  // The server works out the period (same rules as the phone app): the default start is the shift
  // after the last paid period, else the first entry; the unpaid total covers all entries and all
  // payments, with no row limits; and it says whether the range overlaps an earlier payment.
  // A ref remembers the last request so the auto-selected range doesn't trigger a second call.
  const [autoSelectDone, setAutoSelectDone] = useState(false)
  const lastPeriodKey = useRef('')

  const applyPeriod = (data: PaymentPeriod) => {
    setPeriodAmount(data.unpaid.amount)
    setPeriodCount(data.unpaid.count)
    setExistingPaymentForPeriod(data.overlaps)
  }

  // When the person changes: ask for the default period ending now
  useEffect(() => {
    const selected = recipientType === 'farmer' ? selectedFarmer : selectedCustomer
    setAutoSelectDone(false)
    if (!selected) return

    let cancelled = false
    const today = getToday()
    const shift = initialShiftRef.current
    const person = recipientType === 'farmer' ? { farmerId: selected.id } : { customerId: selected.id }
    setIsCalculating(true)
    paymentsApi
      .period({ ...person, to: today, toShift: shift })
      .then((res) => {
        const data = (res as ApiResponse<PaymentPeriod>).data
        if (cancelled || !data) return
        setFromDate(data.from.date)
        setFromShift(data.from.shift)
        setToDate(today)
        setToShift(shift)
        applyPeriod(data)
        lastPeriodKey.current = [selected.id, data.from.date, data.from.shift, today, shift].join('|')
        setAutoSelectDone(true)
      })
      .catch((error) => {
        console.error('Failed to load payment period:', error)
        if (!cancelled) {
          setPeriodAmount(null)
          setPeriodCount(0)
          setExistingPaymentForPeriod(false)
          setAutoSelectDone(true)
        }
      })
      .finally(() => !cancelled && setIsCalculating(false))
    return () => {
      cancelled = true
    }
  }, [selectedFarmer, selectedCustomer, recipientType])

  // When the user changes the range: recalculate on the server
  useEffect(() => {
    const selected = recipientType === 'farmer' ? selectedFarmer : selectedCustomer
    if (isAdvance) {
      setPeriodAmount(null)
      setPeriodCount(0)
      setExistingPaymentForPeriod(false)
      return
    }
    if (!selected || !autoSelectDone) return
    const key = [selected.id, fromDate, fromShift, toDate, toShift].join('|')
    if (key === lastPeriodKey.current) return

    let cancelled = false
    const person = recipientType === 'farmer' ? { farmerId: selected.id } : { customerId: selected.id }
    setIsCalculating(true)
    paymentsApi
      .period({ ...person, from: fromDate, fromShift, to: toDate, toShift })
      .then((res) => {
        const data = (res as ApiResponse<PaymentPeriod>).data
        if (cancelled || !data) return
        applyPeriod(data)
        lastPeriodKey.current = key
      })
      .catch((error) => {
        console.error('Failed to calculate period total:', error)
        if (!cancelled) {
          setPeriodAmount(null)
          setPeriodCount(0)
          setExistingPaymentForPeriod(false)
        }
      })
      .finally(() => !cancelled && setIsCalculating(false))
    return () => {
      cancelled = true
    }
  }, [recipientType, selectedFarmer, selectedCustomer, fromDate, toDate, fromShift, toShift, isAdvance, autoSelectDone])

  // Switching back from advance must recalculate even if the range is unchanged
  useEffect(() => {
    if (isAdvance) lastPeriodKey.current = ''
  }, [isAdvance])

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) return

    if (recipientType === 'farmer' && !selectedFarmer) return
    if (recipientType === 'customer' && !selectedCustomer) return

    try {
      setIsSubmitting(true)

      const paymentType: PaymentType = recipientType === 'farmer'
        ? (isAdvance ? 'ADVANCE_TO_FARMER' : 'PAID_TO_FARMER')
        : (isAdvance ? 'ADVANCE_FROM_CUSTOMER' : 'RECEIVED_FROM_CUSTOMER')

      await addPayment({
        farmerId: recipientType === 'farmer' ? selectedFarmer!.id : undefined,
        customerId: recipientType === 'customer' ? selectedCustomer!.id : undefined,
        date: paymentDate,
        amount: amountNum,
        type: paymentType,
        method: paymentMethod,
        notes: notes || undefined,
        periodFromDate: isAdvance ? undefined : fromDate,
        periodToDate: isAdvance ? undefined : toDate,
        periodFromShift: isAdvance ? undefined : fromShift,
        periodToShift: isAdvance ? undefined : toShift
      })

      navigate(searchParams.get('from') || '/payments')
    } catch (error) {
      console.error('Failed to add payment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selected = recipientType === 'farmer' ? selectedFarmer : selectedCustomer
  const balance = selected
    ? recipientType === 'farmer'
      ? (selected as Farmer).balance
      : (selected as Customer).balance
    : 0

  return (
    <AppShell title={recipientType === 'farmer' ? t('payment.payFarmer') : t('payment.receiveCustomer')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Selected Recipient */}
        {selected && (
          <>
            <Card>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  recipientType === 'farmer' ? 'bg-green-100 dark:bg-green-900/50' : 'bg-blue-100 dark:bg-blue-900/50'
                }`}>
                  {recipientType === 'farmer' ? (
                    <User className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <UserCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selected.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {balance > 0
                      ? `${t('payment.balanceDue')}: ${formatCurrency(balance)}`
                      : balance < 0
                      ? `${t('payment.overpaid')}: ${formatCurrency(Math.abs(balance))}`
                      : t('farmer.settled')
                    }
                  </p>
                </div>
              </div>
            </Card>

            {/* Regular / Advance Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setIsAdvance(false)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  !isAdvance
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {recipientType === 'farmer' ? t('payment.paidToFarmer') : t('payment.receivedFromCustomer')}
              </button>
              <button
                onClick={() => setIsAdvance(true)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  isAdvance
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {t('payment.advance')}
              </button>
            </div>

            {/* Payment Date */}
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('payment.paymentDate')}
                </p>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  max={getToday()}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </Card>

            {/* Date+Shift Filter (hidden for advance payments) */}
            {!isAdvance && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t('payment.dateFilter')}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('payment.fromDate')}
                      </label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        max={toDate}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('payment.fromShift')}
                      </label>
                      <ShiftToggle value={fromShift} onChange={setFromShift} size="sm" showIcons={false} fullWidth />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('payment.toDate')}
                      </label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        min={fromDate}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('payment.toShift')}
                      </label>
                      <ShiftToggle value={toShift} onChange={setToShift} size="sm" showIcons={false} fullWidth />
                    </div>
                  </div>

                  {/* Period Total */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-600">
                    {isCalculating ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        {t('payment.calculating')}
                      </p>
                    ) : periodAmount !== null ? (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('payment.periodTotal')}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(periodAmount)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {periodCount} {t('payment.entries')}
                        </p>
                        {existingPaymentForPeriod && (
                          <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-left">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 dark:text-red-300">
                              {t('payment.alreadyPaidForPeriod')}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            )}

            {/* Amount Entry */}
            <Card>
              <div className="text-center mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {t('payment.paymentAmount')}
                </p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                  ₹{amount || '0'}
                </p>
              </div>

              {/* Quick amount buttons */}
              {!isAdvance && periodAmount !== null && periodAmount > 0 && (
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount((Math.round(periodAmount * 100) / 100).toString())}
                    fullWidth
                  >
                    {t('payment.fullPayment')} ({formatCurrency(periodAmount)})
                  </Button>
                </div>
              )}

              <NumberPad
                value={amount}
                onChange={setAmount}
                maxLength={8}
                allowDecimal={false}
              />
            </Card>

            {/* Payment Method */}
            <Card>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                {t('payment.method')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                      paymentMethod === method
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {t(`payment.${method.toLowerCase().replace('_', '')}`)}
                  </button>
                ))}
              </div>
            </Card>

            {/* Notes */}
            <Card>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                {t('common.notes')} ({t('common.optional')})
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('payment.notesPlaceholder')}
                maxLength={500}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
              />
            </Card>

            {/* Submit */}
            <Button
              onClick={() => setShowConfirm(true)}
              isLoading={isSubmitting}
              disabled={!amount || parseFloat(amount) <= 0 || (!isAdvance && existingPaymentForPeriod)}
              fullWidth
              size="lg"
            >
              {recipientType === 'farmer' ? t('payment.payFarmer') : t('payment.receiveCustomer')}
            </Button>

            {/* Confirmation Dialog */}
            {showConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowConfirm(false)}>
                <div className="bg-white dark:bg-gray-800 w-full rounded-t-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white text-center">
                    {t('common.confirm')}
                  </p>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex justify-between">
                      <span>{recipientType === 'farmer' ? t('payment.payFarmer') : t('payment.receiveCustomer')}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selected?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('common.amount')}</span>
                      <span className="font-bold text-xl text-gray-900 dark:text-white">{formatCurrency(parseFloat(amount))}</span>
                    </div>
                    {isAdvance && (
                      <div className="flex justify-between">
                        <span>{t('payment.advance')}</span>
                        <span className="text-orange-600 dark:text-orange-400">{t('common.yes')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" fullWidth onClick={() => setShowConfirm(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button fullWidth onClick={() => { setShowConfirm(false); handleSubmit() }} isLoading={isSubmitting}>
                      {t('common.confirm')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
