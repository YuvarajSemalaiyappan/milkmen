import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User, UserCircle, Calculator } from 'lucide-react'
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

function getStartOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
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
  // When both shifts are the same, filter ALL dates to that shift only
  if (fromShift === toShift) {
    if (recordDate < fromDate || recordDate > toDate) return false
    return recordShift === fromShift
  }

  // Different shifts: treat as a range with shift boundaries on edge dates
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

  const { activeFarmers } = useFarmers()
  const { activeCustomers } = useCustomers()

  const [recipientType, setRecipientType] = useState<RecipientType>(
    (searchParams.get('type') as RecipientType) || 'farmer'
  )
  const [selectedFarmer, setSelectedFarmer] = useState<LocalFarmer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null)
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [notes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Date+shift filter state
  const [fromDate, setFromDate] = useState(getStartOfMonth)
  const [toDate, setToDate] = useState(getToday)
  const [fromShift, setFromShift] = useState<Shift>('MORNING')
  const [toShift, setToShift] = useState<Shift>('EVENING')
  const [periodAmount, setPeriodAmount] = useState<number | null>(null)
  const [periodCount, setPeriodCount] = useState(0)
  const [isCalculating, setIsCalculating] = useState(false)

  // Pre-select from URL params
  useEffect(() => {
    const farmerId = searchParams.get('farmerId')
    const customerId = searchParams.get('customerId')

    if (farmerId) {
      const farmer = activeFarmers.find((f) => f.id === farmerId)
      if (farmer) {
        setRecipientType('farmer')
        setSelectedFarmer(farmer)
      }
    } else if (customerId) {
      const customer = activeCustomers.find((c) => c.id === customerId)
      if (customer) {
        setRecipientType('customer')
        setSelectedCustomer(customer)
      }
    }
  }, [searchParams, activeFarmers, activeCustomers])

  // Calculate period total when filters or recipient change
  const calculatePeriodTotal = useCallback(async () => {
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
          .where('data.date')
          .between(fromDate, toDate, true, true)
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
          .where('data.date')
          .between(fromDate, toDate, true, true)
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
    } catch (error) {
      console.error('Failed to calculate period total:', error)
      setPeriodAmount(null)
      setPeriodCount(0)
    } finally {
      setIsCalculating(false)
    }
  }, [recipientType, selectedFarmer, selectedCustomer, fromDate, toDate, fromShift, toShift])

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
      const today = new Date().toISOString().split('T')[0]

      const paymentType: PaymentType = recipientType === 'farmer'
        ? 'PAID_TO_FARMER'
        : 'RECEIVED_FROM_CUSTOMER'

      const paymentData = {
        farmerId: recipientType === 'farmer' ? selectedFarmer!.id : undefined,
        customerId: recipientType === 'customer' ? selectedCustomer!.id : undefined,
        date: today,
        amount: amountNum,
        type: paymentType,
        method: paymentMethod,
        notes: notes || undefined
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

      // Update balance
      if (recipientType === 'farmer' && selectedFarmer) {
        // Paying farmer reduces what we owe them
        await db.farmers.update(selectedFarmer.id, {
          'data.balance': selectedFarmer.data.balance - amountNum,
          updatedAt: timestamp
        })
      } else if (recipientType === 'customer' && selectedCustomer) {
        // Receiving from customer reduces what they owe us
        await db.customers.update(selectedCustomer.id, {
          'data.balance': selectedCustomer.data.balance - amountNum,
          updatedAt: timestamp
        })
      }

      // Queue for sync
      await syncService.queueSync('payments', localId, 'create', {
        ...paymentData,
        localId
      })

      addToast({ type: 'success', message: t('payment.paymentSaved') })
      navigate('/payments')
    } catch (error) {
      console.error('Failed to add payment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const recipients = recipientType === 'farmer' ? activeFarmers : activeCustomers
  const selected = recipientType === 'farmer' ? selectedFarmer : selectedCustomer
  const balance = selected
    ? recipientType === 'farmer'
      ? (selected as LocalFarmer).data.balance
      : (selected as LocalCustomer).data.balance
    : 0

  return (
    <AppShell title={t('payment.addPayment')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Payment Type Toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => {
              setRecipientType('farmer')
              setSelectedCustomer(null)
            }}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
              recipientType === 'farmer'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {t('payment.payFarmer')}
          </button>
          <button
            onClick={() => {
              setRecipientType('customer')
              setSelectedFarmer(null)
            }}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
              recipientType === 'customer'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {t('payment.receiveCustomer')}
          </button>
        </div>

        {/* Select Recipient */}
        {!selected && (
          <Card padding="none">
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-y-auto">
              {recipients.map((item) => {
                const data = 'data' in item ? item.data : item
                const itemBalance = (data as { balance: number }).balance
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        if (recipientType === 'farmer') {
                          setSelectedFarmer(item as LocalFarmer)
                        } else {
                          setSelectedCustomer(item as LocalCustomer)
                        }
                      }}
                      className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        recipientType === 'farmer' ? 'bg-green-100 dark:bg-green-900/50' : 'bg-blue-100 dark:bg-blue-900/50'
                      }`}>
                        {recipientType === 'farmer' ? (
                          <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {(data as { name: string }).name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${
                          itemBalance > 0
                            ? recipientType === 'farmer' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {formatCurrency(Math.abs(itemBalance))}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {recipientType === 'farmer'
                            ? itemBalance > 0 ? t('farmer.weOwe') : 'Settled'
                            : itemBalance > 0 ? t('customer.theyOwe') : 'Settled'
                          }
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

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
                    {t('payment.balanceDue')}: {formatCurrency(Math.abs(balance))}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFarmer(null)
                    setSelectedCustomer(null)
                    setAmount('')
                  }}
                >
                  {t('common.edit')}
                </Button>
              </div>
            </Card>

            {/* Date+Shift Filter */}
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
                      {periodAmount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAmount(Math.round(periodAmount).toString())}
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
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'UPI', 'BANK_TRANSFER'] as PaymentMethod[]).map((method) => (
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

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!amount || parseFloat(amount) <= 0}
              fullWidth
              size="lg"
            >
              {recipientType === 'farmer' ? t('payment.payFarmer') : t('payment.receiveCustomer')}
            </Button>
          </>
        )}
      </div>
    </AppShell>
  )
}
