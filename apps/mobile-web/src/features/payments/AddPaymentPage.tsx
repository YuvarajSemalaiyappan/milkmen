import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User, UserCircle, Calculator, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { NumberPad, ShiftToggle } from '@/components/common'
import { useFarmers, useCustomers } from '@/hooks'
import { useAppStore } from '@/store'
import { db, generateLocalId, now } from '@/db/localDb'
import { syncService } from '@/services/syncService'
import { formatCurrency } from '@/utils/format'
import type { LocalFarmer, LocalCustomer, PaymentType, PaymentMethod, Shift } from '@/types'

type RecipientType = 'farmer' | 'customer'

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function nextShift(date: string, shift: Shift): { date: string; shift: Shift } {
  if (shift === 'MORNING') {
    return { date, shift: 'EVENING' }
  }
  // EVENING → next day MORNING
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return { date: d.toISOString().split('T')[0], shift: 'MORNING' }
}

function shiftOrd(shift: Shift): number {
  return shift === 'MORNING' ? 0 : 1
}

function isInShiftRange(
  recordDate: string,
  recordShift: Shift,
  fromDate: string,
  fromShift: Shift,
  toDate: string,
  toShift: Shift
): boolean {
  if (recordDate > fromDate && recordDate < toDate) return true
  if (recordDate === fromDate && recordDate === toDate) {
    return shiftOrd(recordShift) >= shiftOrd(fromShift) && shiftOrd(recordShift) <= shiftOrd(toShift)
  }
  if (recordDate === fromDate) return shiftOrd(recordShift) >= shiftOrd(fromShift)
  if (recordDate === toDate) return shiftOrd(recordShift) <= shiftOrd(toShift)
  return false
}

export function AddPaymentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const addToast = useAppStore((state) => state.addToast)
  const currentShift = useAppStore((state) => state.currentShift)
  const initialShiftRef = useRef(currentShift)

  const { activeFarmers } = useFarmers()
  const { activeCustomers } = useCustomers()

  const recipientType: RecipientType = (searchParams.get('type') as RecipientType) || 'farmer'
  const [selectedFarmer, setSelectedFarmer] = useState<LocalFarmer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null)
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

  // Auto-select date range based on last payment for this person
  useEffect(() => {
    const selected = recipientType === 'farmer' ? selectedFarmer : selectedCustomer
    if (!selected) return

    const autoSelectDates = async () => {
      const allPayments = await db.payments.toArray()
      const personPayments = allPayments
        .filter((p) => {
          if (recipientType === 'farmer') return p.data.farmerId === selected.id
          return p.data.customerId === selected.id
        })
        .filter((p) => p.data.periodToDate && p.data.periodToShift)
        .sort((a, b) => {
          // Sort by periodToDate desc, then periodToShift desc
          if (a.data.periodToDate! > b.data.periodToDate!) return -1
          if (a.data.periodToDate! < b.data.periodToDate!) return 1
          return a.data.periodToShift === 'EVENING' ? -1 : 1
        })

      if (personPayments.length > 0) {
        // Sort ascending by (periodFromDate, periodFromShift) to find contiguous coverage
        const sorted = [...personPayments].sort((a, b) => {
          if (a.data.periodFromDate! < b.data.periodFromDate!) return -1
          if (a.data.periodFromDate! > b.data.periodFromDate!) return 1
          return shiftOrd(a.data.periodFromShift!) - shiftOrd(b.data.periodFromShift!)
        })

        // Merge contiguous/overlapping periods to find the paid-till point
        let paidTillDate = sorted[0].data.periodToDate!
        let paidTillShift = sorted[0].data.periodToShift!
        for (let i = 1; i < sorted.length; i++) {
          const p = sorted[i]
          const paidTillNext = nextShift(paidTillDate, paidTillShift)
          const fromDate = p.data.periodFromDate!
          const fromShift = p.data.periodFromShift!
          // Contiguous: next period starts at or before the shift after current end
          const startsBeforeOrAtEnd = fromDate < paidTillDate
            || (fromDate === paidTillDate && shiftOrd(fromShift) <= shiftOrd(paidTillShift))
          const startsAtNextShift = fromDate === paidTillNext.date && fromShift === paidTillNext.shift
          if (startsBeforeOrAtEnd || startsAtNextShift) {
            // Extend if this payment goes further
            if (p.data.periodToDate! > paidTillDate
              || (p.data.periodToDate! === paidTillDate && shiftOrd(p.data.periodToShift!) > shiftOrd(paidTillShift))) {
              paidTillDate = p.data.periodToDate!
              paidTillShift = p.data.periodToShift!
            }
          } else {
            break // gap found
          }
        }

        const next = nextShift(paidTillDate, paidTillShift)
        setFromDate(next.date)
        setFromShift(next.shift)
      } else {
        // No previous payment — default to first collection/delivery for this person
        let firstDate: string | null = null
        let firstShift: Shift = 'MORNING'

        if (recipientType === 'farmer') {
          const collections = await db.collections.toArray()
          const personCollections = collections
            .filter((c) => c.data.farmerId === selected.id)
            .sort((a, b) => {
              if (a.data.date < b.data.date) return -1
              if (a.data.date > b.data.date) return 1
              return a.data.shift === 'MORNING' ? -1 : 1
            })
          if (personCollections.length > 0) {
            firstDate = personCollections[0].data.date
            firstShift = personCollections[0].data.shift
          }
        } else {
          const deliveries = await db.deliveries.toArray()
          const personDeliveries = deliveries
            .filter((d) => d.data.customerId === selected.id)
            .sort((a, b) => {
              if (a.data.date < b.data.date) return -1
              if (a.data.date > b.data.date) return 1
              return a.data.shift === 'MORNING' ? -1 : 1
            })
          if (personDeliveries.length > 0) {
            firstDate = personDeliveries[0].data.date
            firstShift = personDeliveries[0].data.shift
          }
        }

        if (firstDate) {
          setFromDate(firstDate)
          setFromShift(firstShift)
        } else {
          // No records at all — fallback to today
          setFromDate(getToday())
          setFromShift('MORNING')
        }
      }
      setToDate(getToday())
      setToShift(initialShiftRef.current)
    }
    autoSelectDates()
  }, [selectedFarmer, selectedCustomer, recipientType])

  // Calculate period total when filters or recipient change
  const calculatePeriodTotal = useCallback(async () => {
    if (isAdvance) {
      setPeriodAmount(null)
      setPeriodCount(0)
      setExistingPaymentForPeriod(false)
      return
    }

    const selected = recipientType === 'farmer' ? selectedFarmer : selectedCustomer
    if (!selected) {
      setPeriodAmount(null)
      setPeriodCount(0)
      return
    }

    setIsCalculating(true)
    try {
      let total = 0
      let count = 0

      if (recipientType === 'farmer') {
        const collections = await db.collections
          .where('[data.date]')
          .between([fromDate], [toDate], true, true)
          .toArray()

        for (const c of collections) {
          if (
            c.data.farmerId === selected.id &&
            isInShiftRange(c.data.date, c.data.shift, fromDate, fromShift, toDate, toShift)
          ) {
            total += c.data.totalAmount
            count++
          }
        }
      } else {
        const deliveries = await db.deliveries
          .where('[data.date]')
          .between([fromDate], [toDate], true, true)
          .toArray()

        for (const d of deliveries) {
          if (
            d.data.customerId === selected.id &&
            d.data.status === 'DELIVERED' &&
            isInShiftRange(d.data.date, d.data.shift, fromDate, fromShift, toDate, toShift)
          ) {
            total += d.data.totalAmount
            count++
          }
        }
      }

      setPeriodAmount(total)
      setPeriodCount(count)

      // Check for existing payment with overlapping period
      const allPayments = await db.payments.toArray()
      const personId = selected.id
      const hasDuplicate = allPayments.some((p) => {
        const matchesPerson = recipientType === 'farmer'
          ? p.data.farmerId === personId
          : p.data.customerId === personId
        if (!matchesPerson) return false
        if (!p.data.periodFromDate || !p.data.periodToDate || !p.data.periodFromShift || !p.data.periodToShift) return false

        // Two periods overlap unless one ends before the other starts
        const aEndBeforeBStart = toDate < p.data.periodFromDate
          || (toDate === p.data.periodFromDate && shiftOrd(toShift) < shiftOrd(p.data.periodFromShift))
        const bEndBeforeAStart = p.data.periodToDate < fromDate
          || (p.data.periodToDate === fromDate && shiftOrd(p.data.periodToShift) < shiftOrd(fromShift))

        return !aEndBeforeBStart && !bEndBeforeAStart
      })
      setExistingPaymentForPeriod(hasDuplicate)
    } catch (error) {
      console.error('Failed to calculate period total:', error)
      setPeriodAmount(null)
      setPeriodCount(0)
      setExistingPaymentForPeriod(false)
    } finally {
      setIsCalculating(false)
    }
  }, [recipientType, selectedFarmer, selectedCustomer, fromDate, toDate, fromShift, toShift, isAdvance])

  useEffect(() => {
    calculatePeriodTotal()
  }, [calculatePeriodTotal])

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) return

    if (recipientType === 'farmer' && !selectedFarmer) return
    if (recipientType === 'customer' && !selectedCustomer) return

    try {
      setIsSubmitting(true)

      const localId = generateLocalId()
      const timestamp = now()

      const paymentType: PaymentType = recipientType === 'farmer'
        ? (isAdvance ? 'ADVANCE_TO_FARMER' : 'PAID_TO_FARMER')
        : (isAdvance ? 'ADVANCE_FROM_CUSTOMER' : 'RECEIVED_FROM_CUSTOMER')

      const paymentData = {
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
      }

      // Add to local DB
      await db.payments.add({
        id: localId,
        localId,
        syncStatus: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
        data: paymentData
      })

      // Update balance atomically
      if (recipientType === 'farmer' && selectedFarmer) {
        await db.farmers.where('id').equals(selectedFarmer.id).modify(f => {
          f.data.balance -= amountNum
          f.updatedAt = timestamp
        })
      } else if (recipientType === 'customer' && selectedCustomer) {
        await db.customers.where('id').equals(selectedCustomer.id).modify(f => {
          f.data.balance -= amountNum
          f.updatedAt = timestamp
        })
      }

      // Queue for sync
      await syncService.queueSync('payments', localId, 'create', {
        ...paymentData,
        localId
      })

      addToast({ type: 'success', message: t('payment.paymentSaved') })
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
      ? (selected as LocalFarmer).data.balance
      : (selected as LocalCustomer).data.balance
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
                    {selected.data.name}
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
                        {periodAmount > 0 && !existingPaymentForPeriod && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAmount((Math.round(periodAmount * 100) / 100).toString())}
                            fullWidth
                            className="mt-2"
                          >
                            {t('payment.usePeriodTotal')} ({formatCurrency(periodAmount)})
                          </Button>
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
              {balance > 0 && (
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(Math.abs(balance).toString())}
                    fullWidth
                  >
                    {t('payment.fullPayment')} ({formatCurrency(Math.abs(balance))})
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
                      <span className="font-medium text-gray-900 dark:text-white">{selected?.data.name}</span>
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
