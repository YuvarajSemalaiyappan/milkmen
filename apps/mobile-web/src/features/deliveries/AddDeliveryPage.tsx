import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, User } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { ShiftToggle, QuickPad } from '@/components/common'
import { useCustomers } from '@/hooks/useCustomers'
import { useDeliveries } from '@/hooks/useDeliveries'
import { useAppStore } from '@/store'
import { customersApi } from '@/services/api'
import { formatCurrency, formatRate } from '@/utils/format'
import { calculateTotal } from '@/utils/calculate'
import type { LocalCustomer, ApiResponse, Customer } from '@/types'

type Step = 'select-customer' | 'enter-quantity'

export function AddDeliveryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)

  const { activeCustomers, searchCustomers, isLoading } = useCustomers()
  const { addDelivery } = useDeliveries()

  const [step, setStep] = useState<Step>('select-customer')
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredCustomers, setFilteredCustomers] = useState<LocalCustomer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null)
  const [quantity, setQuantity] = useState('')
  const [rate, setRate] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if customer is pre-selected
  useEffect(() => {
    const customerId = searchParams.get('customerId')
    if (!customerId || selectedCustomer) return

    // Try local DB first
    const customer = activeCustomers.find((c) => c.id === customerId)
    if (customer) {
      selectCustomer(customer)
      return
    }

    // Fall back to server API if not found locally
    if (activeCustomers.length > 0 || isLoading) return
    const fetchCustomer = async () => {
      try {
        const response = await customersApi.get(customerId) as ApiResponse<Customer>
        if (response.success && response.data) {
          const c = response.data
          const local: LocalCustomer = {
            id: c.id,
            localId: c.id,
            syncStatus: 'SYNCED',
            createdAt: new Date(c.createdAt).getTime(),
            updatedAt: new Date(c.updatedAt).getTime(),
            data: {
              name: c.name,
              phone: c.phone,
              address: c.address,
              defaultRate: c.defaultRate,
              subscriptionQtyAM: c.subscriptionQtyAM,
              subscriptionQtyPM: c.subscriptionQtyPM,
              isActive: c.isActive,
              balance: c.balance,
            },
          }
          selectCustomer(local)
        }
      } catch (error) {
        console.error('Failed to fetch customer:', error)
      }
    }
    fetchCustomer()
  }, [searchParams, activeCustomers, isLoading, selectedCustomer])

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
    // Pre-fill subscription quantity based on current shift
    const subscriptionQty = currentShift === 'MORNING'
      ? customer.data.subscriptionQtyAM
      : customer.data.subscriptionQtyPM
    if (subscriptionQty) {
      setQuantity(subscriptionQty.toString())
    }
    setStep('enter-quantity')
  }

  const handleSubmit = async (navigateTo?: string) => {
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
      navigate(navigateTo || '/deliver')
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
                {filteredCustomers.map((customer) => (
                  <li key={customer.id}>
                    <button
                      onClick={() => selectCustomer(customer)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {customer.data.name}
                        </p>
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
                        {(customer.data.subscriptionQtyAM || customer.data.subscriptionQtyPM) && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {currentShift === 'MORNING'
                              ? customer.data.subscriptionQtyAM
                              : customer.data.subscriptionQtyPM}L ({currentShift === 'MORNING' ? 'AM' : 'PM'})
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {step === 'enter-quantity' && selectedCustomer && (
          <div className="flex flex-col">
            {/* Customer Info + Rate/Notes */}
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {selectedCustomer.data.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {selectedCustomer.data.address}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/customers/${selectedCustomer.id}`)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep('select-customer')
                      setSelectedCustomer(null)
                      setQuantity('')
                      searchParams.delete('customerId')
                      setSearchParams(searchParams, { replace: true })
                    }}
                  >
                    {t('common.change')}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label={t('delivery.ratePerLiter')}
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
                <Input
                  label={t('common.notes')}
                  placeholder="--"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </Card>

            {/* Quantity Entry */}
            <Card className="mt-3">
              <div className="text-center mb-2">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {quantity || '0'} <span className="text-lg">L</span>
                </p>
              </div>
              <QuickPad
                value={quantity}
                onChange={setQuantity}
              />
            </Card>

            {/* Total + Submit */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 bg-green-50 dark:bg-green-900/30 rounded-xl px-4 py-3">
                <p className="text-xs text-green-600 dark:text-green-400">{t('delivery.totalAmount')}</p>
                <p className="text-xl font-bold text-green-900 dark:text-green-100">
                  {formatCurrency(total)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleSubmit()}
                  isLoading={isSubmitting}
                  disabled={!quantity || parseFloat(quantity) <= 0}
                  size="lg"
                  className="px-8"
                >
                  {t('common.save')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(`/payments/add?type=customer&customerId=${selectedCustomer.id}&from=/deliver/add`)}
                  isLoading={isSubmitting}
                  disabled={!quantity || parseFloat(quantity) <= 0}
                  size="sm"
                >
                  {t('payment.saveAndReceive')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
