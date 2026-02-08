import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, User, Check } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { ShiftToggle, NumberPad } from '@/components/common'
import { useCustomers } from '@/hooks/useCustomers'
import { useDeliveries } from '@/hooks/useDeliveries'
import { useAppStore } from '@/store'
import { formatCurrency, formatRate } from '@/utils/format'
import { calculateTotal } from '@/utils/calculate'
import type { LocalCustomer } from '@/types'

type Step = 'select-customer' | 'enter-quantity'

export function AddDeliveryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)

  const { activeCustomers, searchCustomers } = useCustomers()
  const { addDelivery, todayDeliveries } = useDeliveries()

  const [step, setStep] = useState<Step>('select-customer')
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredCustomers, setFilteredCustomers] = useState<LocalCustomer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null)
  const [quantity, setQuantity] = useState('')
  const [rate, setRate] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNumPad, setShowNumPad] = useState(false)

  // Set of customerIds that already have a DELIVERED delivery for today + current shift
  const deliveredSet = useMemo(() => {
    const set = new Set<string>()
    if (!todayDeliveries) return set
    for (const d of todayDeliveries) {
      if (d.data.shift === currentShift && d.data.status === 'DELIVERED') {
        set.add(d.data.customerId)
      }
    }
    return set
  }, [todayDeliveries, currentShift])

  // Sort customers: undelivered first, delivered last
  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      const aDelivered = deliveredSet.has(a.id) ? 1 : 0
      const bDelivered = deliveredSet.has(b.id) ? 1 : 0
      return aDelivered - bDelivered
    })
  }, [filteredCustomers, deliveredSet])

  // Check if customer is pre-selected
  useEffect(() => {
    const customerId = searchParams.get('customerId')
    if (customerId) {
      const customer = activeCustomers.find((c) => c.id === customerId)
      if (customer) {
        selectCustomer(customer)
      }
    }
  }, [searchParams, activeCustomers])

  // Filter customers on search
  useEffect(() => {
    const filter = async () => {
      const results = await searchCustomers(searchQuery)
      setFilteredCustomers(results)
    }
    filter()
  }, [searchQuery, searchCustomers])

  // Initialize filtered customers
  useEffect(() => {
    setFilteredCustomers(activeCustomers)
  }, [activeCustomers])

  const selectCustomer = (customer: LocalCustomer) => {
    setSelectedCustomer(customer)
    setRate(customer.data.defaultRate.toString())
    // Pre-fill subscription quantity if available
    if (customer.data.subscriptionQty) {
      setQuantity(customer.data.subscriptionQty.toString())
    }
    setStep('enter-quantity')
  }

  const handleSubmit = async () => {
    if (!selectedCustomer || !quantity || !rate) return

    try {
      setIsSubmitting(true)
      await addDelivery({
        customerId: selectedCustomer.id,
        shift: currentShift,
        quantity: parseFloat(quantity),
        ratePerLiter: parseFloat(rate),
        notes: notes || undefined
      })
      navigate('/deliver')
    } catch (error) {
      console.error('Failed to add delivery:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const total = quantity && rate
    ? calculateTotal(parseFloat(quantity), parseFloat(rate))
    : 0

  return (
    <AppShell title={t('delivery.addDelivery')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Shift Toggle */}
        <ShiftToggle
          value={currentShift}
          onChange={setCurrentShift}
          fullWidth
        />

        {step === 'select-customer' && (
          <>
            {/* Search */}
            <Input
              placeholder={t('delivery.selectCustomer')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />

            {/* Customer List */}
            <Card padding="none">
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedCustomers.map((customer) => {
                  const isDelivered = deliveredSet.has(customer.id)
                  return (
                    <li key={customer.id}>
                      <button
                        onClick={() => selectCustomer(customer)}
                        className={`w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isDelivered ? 'opacity-60' : ''}`}
                      >
                        {isDelivered ? (
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {customer.data.name}
                            </p>
                            {isDelivered && (
                              <Badge variant="success" size="sm">{t('delivery.delivered')}</Badge>
                            )}
                          </div>
                          {customer.data.address && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {customer.data.address}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatRate(customer.data.defaultRate)}
                          </p>
                          {customer.data.subscriptionQty && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {customer.data.subscriptionQty}L daily
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </>
        )}

        {step === 'enter-quantity' && selectedCustomer && (
          <>
            {/* Selected Customer */}
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedCustomer.data.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedCustomer.data.address}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep('select-customer')
                    setSelectedCustomer(null)
                    setQuantity('')
                  }}
                >
                  {t('common.edit')}
                </Button>
              </div>
            </Card>

            {/* Quantity Entry */}
            <Card>
              <div className="text-center mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {t('delivery.quantity')}
                </p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                  {quantity || '0'} <span className="text-xl">L</span>
                </p>
              </div>
              {showNumPad ? (
                <>
                  <NumberPad
                    value={quantity}
                    onChange={setQuantity}
                    maxLength={6}
                    allowDecimal
                    decimalPlaces={2}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNumPad(false)}
                    className="w-full mt-2 py-2 text-sm font-medium text-blue-600 dark:text-blue-400"
                  >
                    {t('common.back')}
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(quantity) || 0
                          const result = current + n
                          setQuantity(String(parseFloat(result.toFixed(2))))
                        }}
                        className="py-3 rounded-lg text-lg font-semibold bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white active:bg-gray-200 dark:active:bg-gray-600"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[0.25, 0.5, 0.75].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(quantity) || 0
                          const result = current + n
                          setQuantity(String(parseFloat(result.toFixed(2))))
                        }}
                        className="py-3 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white active:bg-gray-200 dark:active:bg-gray-600"
                      >
                        .{String(n).split('.')[1]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuantity('')}
                      className="py-3 rounded-lg text-lg font-semibold bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 active:bg-red-200 dark:active:bg-red-800/50"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNumPad(true)}
                      className="py-3 rounded-lg text-sm font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 active:bg-blue-200 dark:active:bg-blue-800/50"
                    >
                      123
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* Rate */}
            <Card>
              <Input
                label={t('delivery.ratePerLiter')}
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <Input
                label={t('common.notes')}
                placeholder="Optional notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-4"
              />
            </Card>

            {/* Total */}
            <Card className="bg-green-50 border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium text-green-900">
                  {t('delivery.totalAmount')}
                </span>
                <span className="text-2xl font-bold text-green-900">
                  {formatCurrency(total)}
                </span>
              </div>
            </Card>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!quantity || parseFloat(quantity) <= 0}
              fullWidth
              size="lg"
            >
              {t('common.save')}
            </Button>
          </>
        )}
      </div>
    </AppShell>
  )
}
